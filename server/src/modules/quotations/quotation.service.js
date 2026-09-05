import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { toNumber } from '../../utils/money.js';
import { evaluateDiscount } from '../discounts/discountEvaluation.service.js';
import { getApplicableDiscountRule } from '../discounts/discountRule.service.js';
import { writeAudit } from './auditLog.service.js';

// Statuses in which a rep sees the quotation on their own desk, still shaping
// it. Everything else is either mid-flight with someone else or terminal.
const LINES_EDITABLE_STATUSES = ['DRAFT', 'UNDER_NEGOTIATION'];

// Only a REJECTED/WITHDRAWN quotation may seed a new one — both are the
// terminal "no" outcomes docs/SOURCE_OF_TRUTH.md §1.6 requires before a
// re-attempt is allowed. This makes "no more than one open attempt per deal"
// true by construction: a child can never come from a live source.
const REQUOTABLE_STATUSES = ['REJECTED', 'WITHDRAWN'];

// "Confirm"/"withdraw" are customer decisions, but the portal doesn't exist
// yet — these fire from an internal endpoint where a rep records a decision
// they learned about some other way. Same statuses either way: only once the
// customer has actually seen the terms (APPROVED) or is mid-negotiation.
const CUSTOMER_DECISION_STATUSES = ['APPROVED', 'UNDER_NEGOTIATION'];

const displayCode = (id) => `Q-${1000 + id}`;

const toPublicLine = (line) => ({
  id: line.id,
  productId: line.productId,
  product: line.product
    ? { id: line.product.id, sku: line.product.sku, name: line.product.name }
    : undefined,
  quantity: line.quantity,
  unitPrice: toNumber(line.unitPrice),
  discountPercent: toNumber(line.discountPercent),
  ceilingAtEntry: toNumber(line.ceilingAtEntry),
  taxRateAtEntry: toNumber(line.taxRateAtEntry),
  isRecurring: line.isRecurring,
  recurringCycle: line.recurringCycle,
});

// Gross/net/tax are always computed here, never stored — same "derived, not
// stored" rule as Inventory.available (§1.5). At hackathon scale, recomputing
// from a handful of lines on every read costs nothing and can never drift.
const computeTotals = (lines) => {
  let grossTotal = 0;
  let netTotal = 0;
  let taxTotal = 0;

  for (const line of lines) {
    const unitPrice = toNumber(line.unitPrice);
    const discountPercent = toNumber(line.discountPercent);
    const taxRate = toNumber(line.taxRateAtEntry);

    const lineGross = unitPrice * line.quantity;
    const lineNet = lineGross * (1 - discountPercent / 100);
    const lineTax = lineNet * (taxRate / 100);

    grossTotal += lineGross;
    netTotal += lineNet;
    taxTotal += lineTax;
  }

  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  return {
    grossTotal: round2(grossTotal),
    netTotal: round2(netTotal),
    taxTotal: round2(taxTotal),
    grandTotal: round2(netTotal + taxTotal),
  };
};

const toPublicQuotation = (quotation) => ({
  id: quotation.id,
  code: displayCode(quotation.id),
  status: quotation.status,
  customer: quotation.customer
    ? { id: quotation.customer.id, name: quotation.customer.name, tierId: quotation.customer.tierId }
    : { id: quotation.customerId },
  owner: quotation.owner ? { id: quotation.owner.id, name: quotation.owner.name } : { id: quotation.ownerId },
  termsVersion: quotation.termsVersion,
  approvedTermsVersion: quotation.approvedTermsVersion,
  customerReference: quotation.customerReference,
  notes: quotation.notes,
  confirmedAt: quotation.confirmedAt,
  sourceQuoteRequestId: quotation.sourceQuoteRequestId,
  previousQuotationId: quotation.previousQuotationId,
  supersededByQuotationId: quotation.supersededBy?.id ?? null,
  lastActivityAt: quotation.lastActivityAt,
  createdAt: quotation.createdAt,
  updatedAt: quotation.updatedAt,
  chatConversation: quotation.chatConversation
    ? { id: quotation.chatConversation.id, status: quotation.chatConversation.status }
    : null,
  lines: quotation.lines ? quotation.lines.map(toPublicLine) : undefined,
  totals: quotation.lines ? computeTotals(quotation.lines) : undefined,
  approvalRequests: quotation.approvalRequests
    ? quotation.approvalRequests.map((request) => ({
        id: request.id,
        termsVersion: request.termsVersion,
        approvalLevel: request.approvalLevel,
        status: request.status,
        createdAt: request.createdAt,
        steps: request.steps.map((step) => ({
          id: step.id,
          role: step.role,
          sequence: step.sequence,
          status: step.status,
          actedBy: step.actedBy ? { id: step.actedBy.id, name: step.actedBy.name } : null,
          note: step.note,
          actedAt: step.actedAt,
        })),
      }))
    : undefined,
  auditLog: quotation.auditLog
    ? quotation.auditLog.map((entry) => ({
        id: entry.id,
        action: entry.action,
        note: entry.note,
        user: entry.user ? { id: entry.user.id, name: entry.user.name } : null,
        createdAt: entry.createdAt,
      }))
    : undefined,
});

const detailInclude = {
  customer: { select: { id: true, name: true, tierId: true } },
  owner: { select: { id: true, name: true } },
  supersededBy: { select: { id: true } },
  chatConversation: { select: { id: true, status: true } },
  lines: { include: { product: { select: { id: true, sku: true, name: true } } } },
  approvalRequests: {
    orderBy: { createdAt: 'asc' },
    include: {
      steps: {
        orderBy: { sequence: 'asc' },
        include: { actedBy: { select: { id: true, name: true } } },
      },
    },
  },
  auditLog: {
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { id: true, name: true } } },
  },
};

// A Sales Rep only ever sees their own desk; everyone else (Manager, Finance,
// Admin) sees the whole pipeline — matches the access matrix (§6): "Create/
// edit own quotations" is Rep + Manager only, "View all quotations" excludes
// Rep. Centralized here so list and getById can't drift apart on the rule.
const scopeToOwnerIfRep = (actingUser, where) =>
  actingUser.role === 'SALES_REP' ? { ...where, ownerId: actingUser.id } : where;

export const listQuotations = async (filters, actingUser) => {
  const where = scopeToOwnerIfRep(actingUser, {});
  if (filters.status) where.status = filters.status;
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.ownerId) where.ownerId = filters.ownerId;

  const quotations = await prisma.quotation.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, tierId: true } },
      owner: { select: { id: true, name: true } },
      lines: true,
    },
    orderBy: { lastActivityAt: 'desc' },
  });

  return quotations.map(toPublicQuotation);
};

export const getQuotationById = async (id, actingUser) => {
  const quotation = await prisma.quotation.findUnique({ where: { id }, include: detailInclude });
  if (!quotation) throw ApiError.notFound(`No quotation with id ${id}`);

  if (actingUser && actingUser.role === 'SALES_REP' && quotation.ownerId !== actingUser.id) {
    throw ApiError.forbidden('You can only view quotations you own');
  }

  return toPublicQuotation(quotation);
};

// Resolves one line's stored, snapshotted shape from a {productId, quantity,
// discountPercent, isRecurring, recurringCycle} input. Shared by create and
// updateLines so a line looks the same regardless of when it was added.
// Exported so the customer portal builds lines through exactly this path —
// same price snapshot, same ceiling resolution, same validation. A second
// implementation would be a second set of rules to keep in sync.
export const buildLineData = async (tierId, input) => {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product || !product.isActive) {
    throw ApiError.badRequest(`No active product with id ${input.productId}`);
  }

  if (input.isRecurring && !product.isSubscribable) {
    throw ApiError.badRequest(`Product ${product.sku} is not subscribable`, [
      { field: 'isRecurring', message: `${product.name} cannot be sold on a recurring plan` },
    ]);
  }

  // Throws if no DiscountRule governs this tier + category anywhere up the
  // tree — a missing rule is a business error, never a silent allowance.
  const rule = await getApplicableDiscountRule(tierId, product.categoryId);

  return {
    productId: product.id,
    quantity: input.quantity,
    unitPrice: toNumber(product.listPrice),
    discountPercent: input.discountPercent ?? 0,
    ceilingAtEntry: rule.maxDiscountPercent,
    taxRateAtEntry: toNumber(product.taxRate),
    isRecurring: input.isRecurring ?? false,
    recurringCycle: input.isRecurring ? input.recurringCycle : null,
  };
};

export const createQuotation = async (data, actingUser) => {
  let source = null;
  if (data.sourceQuotationId) {
    source = await prisma.quotation.findUnique({
      where: { id: data.sourceQuotationId },
      include: { lines: true },
    });
    if (!source) throw ApiError.notFound(`No quotation with id ${data.sourceQuotationId}`);
    if (!REQUOTABLE_STATUSES.includes(source.status)) {
      throw ApiError.badRequest(
        `Cannot create a new quotation from #${source.id} while it is ${source.status} — only a REJECTED or WITHDRAWN quotation can be re-quoted`
      );
    }

    // previousQuotationId is @unique — at most one child per source — but that
    // constraint would otherwise surface as a raw DB error instead of a clean
    // 409, so it's checked here first.
    const existingChild = await prisma.quotation.findFirst({ where: { previousQuotationId: source.id } });
    if (existingChild) {
      throw ApiError.conflict(
        `${displayCode(source.id)} already has a follow-up quotation (${displayCode(existingChild.id)})`
      );
    }
  }

  const customerId = source ? source.customerId : data.customerId;
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer || !customer.isActive) throw ApiError.badRequest(`No active customer with id ${customerId}`);

  const lineInputs = data.lines && data.lines.length > 0
    ? data.lines
    : source
      ? source.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          discountPercent: toNumber(line.discountPercent),
          isRecurring: line.isRecurring,
          recurringCycle: line.recurringCycle,
        }))
      : [];

  if (lineInputs.length === 0) throw ApiError.badRequest('lines must have at least one entry');

  const lineData = await Promise.all(lineInputs.map((input) => buildLineData(customer.tierId, input)));

  const quotation = await prisma.$transaction(async (tx) => {
    const created = await tx.quotation.create({
      data: {
        customerId,
        ownerId: actingUser.id,
        customerReference: data.customerReference,
        notes: data.notes,
        sourceQuoteRequestId: source ? source.sourceQuoteRequestId : data.sourceQuoteRequestId ?? null,
        previousQuotationId: source ? source.id : null,
        lines: { create: lineData },
      },
    });

    await writeAudit(tx, {
      quotationId: created.id,
      userId: actingUser.id,
      action: 'CREATED',
      note: source ? `Requoted from ${displayCode(source.id)}` : null,
    });

    return created;
  });

  return getQuotationById(quotation.id, actingUser);
};

export const updateQuotationLines = async (quotationId, changes, actingUser) => {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { lines: true },
  });
  if (!quotation) throw ApiError.notFound(`No quotation with id ${quotationId}`);
  if (actingUser.role === 'SALES_REP' && quotation.ownerId !== actingUser.id) {
    throw ApiError.forbidden('You can only edit quotations you own');
  }
  if (!LINES_EDITABLE_STATUSES.includes(quotation.status)) {
    throw ApiError.badRequest(`Lines cannot be edited while the quotation is ${quotation.status}`);
  }

  const ownLineIds = new Set(quotation.lines.map((line) => line.id));
  for (const lineId of [...(changes.remove ?? []), ...(changes.update ?? []).map((u) => u.lineId)]) {
    if (!ownLineIds.has(lineId)) {
      throw ApiError.badRequest(`Line ${lineId} does not belong to quotation ${quotationId}`);
    }
  }

  const customer = await prisma.customer.findUnique({ where: { id: quotation.customerId } });
  const addLineData = await Promise.all((changes.add ?? []).map((input) => buildLineData(customer.tierId, input)));

  const changeCount =
    (changes.add?.length ?? 0) + (changes.update?.length ?? 0) + (changes.remove?.length ?? 0);

  await prisma.$transaction(async (tx) => {
    for (const lineId of changes.remove ?? []) {
      await tx.quotationLine.delete({ where: { id: lineId } });
    }

    for (const update of changes.update ?? []) {
      const { lineId, ...fields } = update;
      const data = {};
      if (fields.quantity !== undefined) data.quantity = fields.quantity;
      if (fields.discountPercent !== undefined) data.discountPercent = fields.discountPercent;
      if (fields.isRecurring !== undefined) data.isRecurring = fields.isRecurring;
      if (fields.recurringCycle !== undefined) data.recurringCycle = fields.recurringCycle;
      await tx.quotationLine.update({ where: { id: lineId }, data });
    }

    for (const lineData of addLineData) {
      await tx.quotationLine.create({ data: { ...lineData, quotationId } });
    }

    await tx.quotation.update({
      where: { id: quotationId },
      data: { termsVersion: { increment: 1 }, lastActivityAt: new Date() },
    });

    await writeAudit(tx, {
      quotationId,
      userId: actingUser.id,
      action: 'LINE_EDITED',
      note: `${changeCount} line change(s): ${changes.add?.length ?? 0} added, ${changes.update?.length ?? 0} updated, ${changes.remove?.length ?? 0} removed`,
    });
  });

  // Editing while under negotiation is the rep applying a customer's counter —
  // it must be re-evaluated and re-routed immediately, not left dangling in a
  // status nobody is watching. Editing a DRAFT does not: evaluation only
  // happens at explicit submit-time for a quotation nobody has seen yet.
  if (quotation.status === 'UNDER_NEGOTIATION') {
    const refreshed = await prisma.quotation.findUnique({ where: { id: quotationId }, include: { lines: true } });
    await routeQuotation(refreshed, actingUser, 'LINE_EDITED');
  }

  return getQuotationById(quotationId, actingUser);
};

// Runs evaluateDiscount() against the quotation's current (snapshotted) lines
// and either auto-confirms or opens a new ApprovalRequest — the one place
// this decision is made, used by both submit and the under-negotiation
// re-evaluate path (§4) so they can never drift apart.
const routeQuotation = async (quotation, actingUser, auditAction) => {
  const evaluation = await evaluateDiscount({
    customerId: quotation.customerId,
    lines: quotation.lines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      discountPercent: toNumber(line.discountPercent),
      unitPrice: toNumber(line.unitPrice),
    })),
  });

  await prisma.$transaction(async (tx) => {
    await writeAudit(tx, { quotationId: quotation.id, userId: actingUser.id, action: auditAction });

    if (!evaluation.approvalRequired) {
      await tx.quotation.update({
        where: { id: quotation.id },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          approvedTermsVersion: quotation.termsVersion,
          lastActivityAt: new Date(),
        },
      });
      await writeAudit(tx, { quotationId: quotation.id, userId: actingUser.id, action: 'AUTO_CONFIRMED' });
      return;
    }

    await tx.approvalRequest.create({
      data: {
        quotationId: quotation.id,
        termsVersion: quotation.termsVersion,
        approvalLevel: evaluation.approvalLevel,
        steps: {
          create: evaluation.approvalChain.map((role, index) => ({
            role,
            sequence: index + 1,
            status: index === 0 ? 'ACTIVE' : 'PENDING',
          })),
        },
      },
    });

    await tx.quotation.update({
      where: { id: quotation.id },
      data: { status: 'PENDING_APPROVAL', lastActivityAt: new Date() },
    });

    await writeAudit(tx, {
      quotationId: quotation.id,
      userId: actingUser.id,
      action: 'ROUTED_FOR_APPROVAL',
      note: `${evaluation.approvalLevel} — blended severity ${evaluation.risk.blendedSeverity}`,
    });
  });
};

export const submitQuotation = async (quotationId, actingUser) => {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { lines: true },
  });
  if (!quotation) throw ApiError.notFound(`No quotation with id ${quotationId}`);
  if (actingUser.role === 'SALES_REP' && quotation.ownerId !== actingUser.id) {
    throw ApiError.forbidden('You can only submit quotations you own');
  }
  if (quotation.status !== 'DRAFT') {
    throw ApiError.badRequest(`Cannot submit a quotation in ${quotation.status} status`);
  }
  if (quotation.lines.length === 0) {
    throw ApiError.badRequest('Add at least one line before submitting');
  }

  await routeQuotation(quotation, actingUser, 'SUBMITTED');

  return getQuotationById(quotationId, actingUser);
};

// Records a customer decision a rep learned about outside the system (no
// portal yet — see the CUSTOMER_DECISION_STATUSES comment above).
const recordCustomerDecision = async (quotationId, actingUser, note, targetStatus, auditAction, extraData = {}) => {
  const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
  if (!quotation) throw ApiError.notFound(`No quotation with id ${quotationId}`);
  if (!CUSTOMER_DECISION_STATUSES.includes(quotation.status)) {
    throw ApiError.badRequest(`Cannot record this decision while the quotation is ${quotation.status}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.quotation.update({
      where: { id: quotationId },
      data: { status: targetStatus, lastActivityAt: new Date(), ...extraData },
    });
    await writeAudit(tx, { quotationId, userId: actingUser.id, action: auditAction, note });
  });

  return getQuotationById(quotationId, actingUser);
};

export const confirmQuotation = (quotationId, actingUser, note) =>
  recordCustomerDecision(quotationId, actingUser, note, 'CONFIRMED', 'CONFIRMED', {
    confirmedAt: new Date(),
  });

export const withdrawQuotation = (quotationId, actingUser, note) =>
  recordCustomerDecision(quotationId, actingUser, note, 'WITHDRAWN', 'WITHDRAWN');
