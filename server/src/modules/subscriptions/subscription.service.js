import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { round2, toNumber } from '../../utils/money.js';

// Cycle length in whole calendar months — used both to roll a period forward
// and, via daysBetween, as the denominator for every proration calculation.
const CYCLE_MONTHS = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 };

export const addCycle = (date, cycle) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + CYCLE_MONTHS[cycle]);
  return result;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Whole days between two dates, floored — "unused days remaining" and "total
// days in period" are both read this way so a proration ratio never depends
// on time-of-day noise.
const daysBetween = (from, to) => Math.max(0, Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY));

/**
 * Called once, inside the same transaction that flips a Quotation to
 * CONFIRMED, for every one of its recurring lines. One Subscription per
 * line — see the schema comment on Subscription — priced from the line's
 * own snapshotted unitPrice/quantity (already resolved against the
 * product's plan config in quotation.service.js#buildLineData).
 */
export const createSubscriptionsForQuotation = async (tx, quotation) => {
  const recurringLines = quotation.lines.filter((line) => line.isRecurring);
  if (recurringLines.length === 0) return;

  const now = new Date();

  for (const line of recurringLines) {
    const periodEnd = addCycle(now, line.recurringCycle);

    await tx.subscription.create({
      data: {
        quotationLineId: line.id,
        customerId: quotation.customerId,
        productId: line.productId,
        cycle: line.recurringCycle,
        quantity: line.quantity,
        unitAmount: line.unitPrice,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
      },
    });
  }
};

const toPublicInvoice = (invoice) => ({
  id: invoice.id,
  periodStart: invoice.periodStart,
  periodEnd: invoice.periodEnd,
  amount: toNumber(invoice.amount),
  status: invoice.status,
  paidAt: invoice.paidAt,
  rejectedAt: invoice.rejectedAt,
  note: invoice.note,
  createdAt: invoice.createdAt,
});

const toPublicChange = (change) => ({
  id: change.id,
  type: change.type,
  oldQuantity: change.oldQuantity,
  newQuantity: change.newQuantity,
  oldCycle: change.oldCycle,
  newCycle: change.newCycle,
  oldUnitAmount: toNumber(change.oldUnitAmount),
  newUnitAmount: toNumber(change.newUnitAmount),
  unusedDays: change.unusedDays,
  prorationAmount: toNumber(change.prorationAmount),
  effectiveDate: change.effectiveDate,
  refundAmount: toNumber(change.refundAmount),
  refundMethod: change.refundMethod,
  note: change.note,
  createdAt: change.createdAt,
});

// The "compact timeline" every screen (internal + portal) reads from: current
// period, next billing date, the amount that next charge will be, and the
// billing date the cycle after that — all derived, never stored, so they can
// never drift from cycle/quantity/unitAmount.
const toPublicSubscription = (subscription) => {
  const periodAmount = round2(toNumber(subscription.unitAmount) * subscription.quantity);
  const followingBillingDate = addCycle(subscription.currentPeriodEnd, subscription.cycle);

  return {
    id: subscription.id,
    product: subscription.product
      ? { id: subscription.product.id, name: subscription.product.name, sku: subscription.product.sku }
      : { id: subscription.productId },
    customer: subscription.customer
      ? { id: subscription.customer.id, name: subscription.customer.name }
      : { id: subscription.customerId },
    quotationLineId: subscription.quotationLineId,
    cycle: subscription.cycle,
    quantity: subscription.quantity,
    unitAmount: toNumber(subscription.unitAmount),
    periodAmount,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    nextBillingDate: subscription.nextBillingDate,
    upcomingCharge: periodAmount,
    followingBillingDate,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    canceledAt: subscription.canceledAt,
    createdAt: subscription.createdAt,
    invoices: subscription.invoices ? subscription.invoices.map(toPublicInvoice) : undefined,
    changes: subscription.changes ? subscription.changes.map(toPublicChange) : undefined,
  };
};

const detailInclude = {
  product: { select: { id: true, name: true, sku: true } },
  customer: { select: { id: true, name: true } },
  invoices: { orderBy: { createdAt: 'desc' } },
  changes: { orderBy: { createdAt: 'desc' } },
};

export const listSubscriptions = async (filters = {}) => {
  const where = {};
  if (filters.customerId) where.customerId = Number(filters.customerId);
  if (filters.status) where.status = filters.status;

  const subscriptions = await prisma.subscription.findMany({
    where,
    include: { product: { select: { id: true, name: true, sku: true } }, customer: { select: { id: true, name: true } } },
    orderBy: { nextBillingDate: 'asc' },
  });

  return subscriptions.map(toPublicSubscription);
};

const getOwnedOrThrow = async (id, customerId) => {
  const subscription = await prisma.subscription.findUnique({ where: { id }, include: detailInclude });
  if (!subscription) throw ApiError.notFound(`No subscription with id ${id}`);
  if (customerId !== undefined && subscription.customerId !== customerId) {
    throw ApiError.notFound(`No subscription with id ${id}`);
  }
  return subscription;
};

export const getSubscriptionById = async (id, customerId) => {
  const subscription = await getOwnedOrThrow(id, customerId);
  return toPublicSubscription(subscription);
};

export const listCustomerSubscriptions = async (customerId) => {
  const subscriptions = await prisma.subscription.findMany({
    where: { customerId },
    include: { product: { select: { id: true, name: true, sku: true } }, invoices: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { nextBillingDate: 'asc' },
  });

  return subscriptions.map(toPublicSubscription);
};

// ── Proration ────────────────────────────────────────────────────────────

// The one formula every mid-cycle change (quantity, plan/frequency, and the
// unused-portion figure cancellation shows) is built from: per-day price for
// the current period, times however many days of it are left. Never re-uses
// a previous calculation across periods — a period's day-count is fixed at
// its own start/end.
const dailyRate = (unitAmount, quantity, periodStart, periodEnd) => {
  const totalDays = Math.max(1, daysBetween(periodStart, periodEnd));
  return (unitAmount * quantity) / totalDays;
};

const previewQuantityChange = (subscription, newQuantity, now = new Date()) => {
  const unitAmount = toNumber(subscription.unitAmount);
  const unusedDays = daysBetween(now, subscription.currentPeriodEnd);

  const oldDaily = dailyRate(unitAmount, subscription.quantity, subscription.currentPeriodStart, subscription.currentPeriodEnd);
  const newDaily = dailyRate(unitAmount, newQuantity, subscription.currentPeriodStart, subscription.currentPeriodEnd);

  const prorationAmount = round2((newDaily - oldDaily) * unusedDays);

  return {
    oldQuantity: subscription.quantity,
    newQuantity,
    unusedDays,
    prorationAmount,
    adjustmentType: prorationAmount > 0 ? 'ADDITIONAL_CHARGE' : prorationAmount < 0 ? 'ACCOUNT_CREDIT' : 'NONE',
    effectiveDate: now,
  };
};

export const previewSubscriptionQuantityChange = async (id, newQuantity, customerId) => {
  const subscription = await getOwnedOrThrow(id, customerId);
  if (subscription.status === 'CANCELLED') throw ApiError.badRequest('This subscription is cancelled');
  if (newQuantity < 1) throw ApiError.badRequest('Quantity must be at least 1');

  return previewQuantityChange(subscription, newQuantity);
};

export const applySubscriptionQuantityChange = async (id, newQuantity, customerId, note) => {
  const subscription = await getOwnedOrThrow(id, customerId);
  if (subscription.status === 'CANCELLED') throw ApiError.badRequest('This subscription is cancelled');
  if (newQuantity < 1) throw ApiError.badRequest('Quantity must be at least 1');

  const preview = previewQuantityChange(subscription, newQuantity);

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({ where: { id }, data: { quantity: newQuantity } });
    await tx.subscriptionChange.create({
      data: {
        subscriptionId: id,
        type: 'QUANTITY_CHANGE',
        oldQuantity: preview.oldQuantity,
        newQuantity: preview.newQuantity,
        unusedDays: preview.unusedDays,
        prorationAmount: preview.prorationAmount,
        effectiveDate: preview.effectiveDate,
        note,
      },
    });
  });

  return getSubscriptionById(id, customerId);
};

const previewPlanChange = (subscription, newCycle, newUnitAmount, now = new Date()) => {
  const oldUnitAmount = toNumber(subscription.unitAmount);
  const unusedDays = daysBetween(now, subscription.currentPeriodEnd);

  const oldDaily = dailyRate(oldUnitAmount, subscription.quantity, subscription.currentPeriodStart, subscription.currentPeriodEnd);
  const newDaily = dailyRate(newUnitAmount, subscription.quantity, subscription.currentPeriodStart, subscription.currentPeriodEnd);

  const prorationAmount = round2((newDaily - oldDaily) * unusedDays);

  return {
    oldCycle: subscription.cycle,
    newCycle,
    oldUnitAmount,
    newUnitAmount,
    unusedDays,
    prorationAmount,
    adjustmentType: prorationAmount > 0 ? 'ADDITIONAL_CHARGE' : prorationAmount < 0 ? 'ACCOUNT_CREDIT' : 'NONE',
    effectiveDate: now,
  };
};

// Resolves the amount a plan/frequency change would bill at: the product's
// configured plan for the new cycle, same lookup buildLineData uses for a
// brand-new recurring line, so a modified subscription is priced exactly the
// way a fresh one selling that cycle would be.
const resolvePlanAmount = async (productId, cycle) => {
  const plan = await prisma.productSubscriptionPlan.findUnique({
    where: { productId_cycle: { productId, cycle } },
  });
  if (!plan || !plan.isActive) {
    throw ApiError.badRequest(`No active ${cycle} plan configured for this product`);
  }
  return toNumber(plan.amount);
};

export const previewSubscriptionPlanChange = async (id, newCycle, customerId) => {
  const subscription = await getOwnedOrThrow(id, customerId);
  if (subscription.status === 'CANCELLED') throw ApiError.badRequest('This subscription is cancelled');

  const newUnitAmount = await resolvePlanAmount(subscription.productId, newCycle);
  return previewPlanChange(subscription, newCycle, newUnitAmount);
};

export const applySubscriptionPlanChange = async (id, newCycle, customerId, note) => {
  const subscription = await getOwnedOrThrow(id, customerId);
  if (subscription.status === 'CANCELLED') throw ApiError.badRequest('This subscription is cancelled');

  const newUnitAmount = await resolvePlanAmount(subscription.productId, newCycle);
  const preview = previewPlanChange(subscription, newCycle, newUnitAmount);

  await prisma.$transaction(async (tx) => {
    // Cycle and amount change immediately; the CURRENT period's start/end are
    // left untouched (the proration above already accounts for the rest of
    // it) — the new cycle length only takes effect from the next renewal.
    await tx.subscription.update({
      where: { id },
      data: { cycle: newCycle, unitAmount: newUnitAmount },
    });
    await tx.subscriptionChange.create({
      data: {
        subscriptionId: id,
        type: 'PLAN_CHANGE',
        oldCycle: preview.oldCycle,
        newCycle: preview.newCycle,
        oldUnitAmount: preview.oldUnitAmount,
        newUnitAmount: preview.newUnitAmount,
        unusedDays: preview.unusedDays,
        prorationAmount: preview.prorationAmount,
        effectiveDate: preview.effectiveDate,
        note,
      },
    });
  });

  return getSubscriptionById(id, customerId);
};

// mode: 'immediate' ends the subscription now and credits whatever unused
// portion of the current (already-paid) period remains. 'period_end' just
// marks cancelAtPeriodEnd — the subscription keeps running (and billing) to
// the end of what was already paid for, so there is nothing to refund.
const previewCancellation = (subscription, mode, now = new Date()) => {
  if (mode === 'period_end') {
    return {
      mode,
      unusedDays: 0,
      refundAmount: 0,
      refundMethod: null,
      effectiveDate: subscription.currentPeriodEnd,
    };
  }

  const unusedDays = daysBetween(now, subscription.currentPeriodEnd);
  const daily = dailyRate(
    toNumber(subscription.unitAmount),
    subscription.quantity,
    subscription.currentPeriodStart,
    subscription.currentPeriodEnd
  );
  const refundAmount = round2(daily * unusedDays);

  return {
    mode,
    unusedDays,
    refundAmount,
    refundMethod: refundAmount > 0 ? 'ACCOUNT_CREDIT' : null,
    effectiveDate: now,
  };
};

export const previewSubscriptionCancellation = async (id, mode, customerId) => {
  const subscription = await getOwnedOrThrow(id, customerId);
  if (subscription.status === 'CANCELLED') throw ApiError.badRequest('This subscription is already cancelled');

  return previewCancellation(subscription, mode);
};

export const cancelSubscription = async (id, mode, customerId, note) => {
  const subscription = await getOwnedOrThrow(id, customerId);
  if (subscription.status === 'CANCELLED') throw ApiError.badRequest('This subscription is already cancelled');

  const resolved = previewCancellation(subscription, mode);

  await prisma.$transaction(async (tx) => {
    if (mode === 'period_end') {
      await tx.subscription.update({ where: { id }, data: { cancelAtPeriodEnd: true } });
    } else {
      await tx.subscription.update({
        where: { id },
        data: { status: 'CANCELLED', canceledAt: new Date(), cancelAtPeriodEnd: false },
      });
    }

    await tx.subscriptionChange.create({
      data: {
        subscriptionId: id,
        type: 'CANCELLATION',
        unusedDays: resolved.unusedDays,
        refundAmount: resolved.refundAmount,
        refundMethod: resolved.refundMethod,
        effectiveDate: resolved.effectiveDate,
        note,
      },
    });
  });

  return getSubscriptionById(id, customerId);
};

// ── Renewal billing (mock — no payment gateway) ─────────────────────────

/**
 * The in-process scheduler's tick (see server.js). For every ACTIVE
 * subscription whose nextBillingDate has arrived, raises a PENDING_APPROVAL
 * invoice for the period just ending and parks the subscription in
 * PENDING_RENEWAL_APPROVAL until the customer acts on it in the portal — the
 * "ask for approval, then confirm" step from the brief. Never charges
 * anything itself.
 */
export const runBillingCycle = async (now = new Date()) => {
  const due = await prisma.subscription.findMany({
    where: { status: 'ACTIVE', nextBillingDate: { lte: now } },
  });

  const created = [];
  for (const subscription of due) {
    // cancelAtPeriodEnd was requested mid-cycle — this is the period it
    // asked to end at, so it stops here instead of renewing.
    if (subscription.cancelAtPeriodEnd) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'CANCELLED', canceledAt: now },
      });
      continue;
    }

    const periodStart = subscription.currentPeriodEnd;
    const periodEnd = addCycle(periodStart, subscription.cycle);
    const amount = round2(toNumber(subscription.unitAmount) * subscription.quantity);

    await prisma.$transaction([
      prisma.subscriptionInvoice.create({
        data: { subscriptionId: subscription.id, periodStart, periodEnd, amount },
      }),
      prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'PENDING_RENEWAL_APPROVAL' },
      }),
    ]);

    created.push(subscription.id);
  }

  return { checked: due.length, invoicesCreated: created.length };
};

/** Customer clicks "Approve & Pay" — the whole mock payment step. */
export const approveRenewalInvoice = async (subscriptionId, invoiceId, customerId) => {
  const invoice = await prisma.subscriptionInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.subscriptionId !== subscriptionId) {
    throw ApiError.notFound(`No invoice ${invoiceId} on subscription ${subscriptionId}`);
  }
  if (invoice.status !== 'PENDING_APPROVAL') {
    throw ApiError.badRequest(`Invoice is already ${invoice.status}`);
  }

  await getOwnedOrThrow(subscriptionId, customerId);

  await prisma.$transaction([
    prisma.subscriptionInvoice.update({ where: { id: invoiceId }, data: { status: 'PAID', paidAt: new Date() } }),
    prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: invoice.periodStart,
        currentPeriodEnd: invoice.periodEnd,
        nextBillingDate: invoice.periodEnd,
      },
    }),
  ]);

  return getSubscriptionById(subscriptionId, customerId);
};

/** Customer declines the renewal — the subscription does not continue. */
export const rejectRenewalInvoice = async (subscriptionId, invoiceId, customerId, note) => {
  const invoice = await prisma.subscriptionInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.subscriptionId !== subscriptionId) {
    throw ApiError.notFound(`No invoice ${invoiceId} on subscription ${subscriptionId}`);
  }
  if (invoice.status !== 'PENDING_APPROVAL') {
    throw ApiError.badRequest(`Invoice is already ${invoice.status}`);
  }

  await getOwnedOrThrow(subscriptionId, customerId);

  await prisma.$transaction([
    prisma.subscriptionInvoice.update({
      where: { id: invoiceId },
      data: { status: 'REJECTED', rejectedAt: new Date(), note },
    }),
    prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'CANCELLED', canceledAt: new Date() },
    }),
    prisma.subscriptionChange.create({
      data: {
        subscriptionId,
        type: 'CANCELLATION',
        unusedDays: 0,
        refundAmount: 0,
        effectiveDate: new Date(),
        note: note ?? 'Customer declined the renewal invoice',
      },
    }),
  ]);

  return getSubscriptionById(subscriptionId, customerId);
};
