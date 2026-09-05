import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { toNumber } from '../../utils/money.js';
import { evaluateDiscount } from '../discounts/discountEvaluation.service.js';
import { getApplicableDiscountRule } from '../discounts/discountRule.service.js';
import { resolveAllocations } from '../inventory/inventory.service.js';
import { findActiveRecommendation } from '../recommendations/recommendation.service.js';
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
  // Null for a directly-picked line — set only when this line came from
  // accepting an upsell/cross-sell suggestion (see buildLineData below).
  suggestedAs: line.suggestedAs ?? null,
  suggestedFromProduct: line.suggestedFromProduct
    ? { id: line.suggestedFromProduct.id, sku: line.suggestedFromProduct.sku, name: line.suggestedFromProduct.name }
    : null,
  // Warehouse split decided at add-time — see QuotationLineAllocation.
  // Undefined (not []) when the caller didn't include it, same convention
  // as product/suggestedFromProduct above.
  allocations: line.allocations
    ? line.allocations.map((allocation) => ({
        warehouseId: allocation.warehouseId,
        warehouse: allocation.warehouse
          ? { id: allocation.warehouse.id, code: allocation.warehouse.code, name: allocation.warehouse.name }
          : null,
        quantity: allocation.quantity,
      }))
    : undefined,
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
  lines: {
    include: {
      product: { select: { id: true, sku: true, name: true } },
      suggestedFromProduct: { select: { id: true, sku: true, name: true } },
      allocations: { include: { warehouse: { select: { id: true, code: true, name: true } } } },
    },
  },
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

// A client claiming suggestedAs/suggestedFromProductId is trusted only as
// far as it can be checked: a real active ProductRecommendation has to
// exist for exactly this (trigger -> product, type) pairing, AND the
// trigger product has to actually be among this order's OTHER lines — not
// just some product that exists somewhere in the abstract config. Otherwise
// the tag is decorative rather than trustworthy, and any later reporting on
// upsell/cross-sell conversion would be built on unverified data.
const assertSuggestionProvenance = async ({ suggestedAs, suggestedFromProductId, productId, siblingProductIds }) => {
  if (!siblingProductIds.includes(suggestedFromProductId)) {
    throw ApiError.badRequest(
      `Product ${suggestedFromProductId} is not among this quotation's other lines`,
      [{ field: 'suggestedFromProductId', message: 'Must be a product already on this order' }]
    );
  }

  const recommendation = await findActiveRecommendation(suggestedFromProductId, productId, suggestedAs);
  if (!recommendation) {
    throw ApiError.badRequest('No active recommendation matches this suggestion', [
      { field: 'suggestedAs', message: 'This pairing is not a configured, active recommendation' },
    ]);
  }
};

// Resolves one line's stored, snapshotted shape from a {productId, quantity,
// discountPercent, isRecurring, recurringCycle, suggestedAs?,
// suggestedFromProductId?} input. Shared by create and updateLines so a line
// looks the same regardless of when it was added. Exported so the customer
// portal builds lines through exactly this path — same price snapshot, same
// ceiling resolution, same validation. A second implementation would be a
// second set of rules to keep in sync.
//
// siblingProductIds is the set of OTHER product ids already on (or landing
// on, in the same batch as) this order — required only when the input
// claims a suggestion; every existing call site that doesn't pass it keeps
// working unchanged, since that branch is skipped entirely for a directly-
// picked line.
export const buildLineData = async (tierId, input, siblingProductIds = []) => {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product || !product.isActive) {
    throw ApiError.badRequest(`No active product with id ${input.productId}`);
  }

  if (input.isRecurring && !product.isSubscribable) {
    throw ApiError.badRequest(`Product ${product.sku} is not subscribable`, [
      { field: 'isRecurring', message: `${product.name} cannot be sold on a recurring plan` },
    ]);
  }

  if (input.suggestedAs) {
    await assertSuggestionProvenance({
      suggestedAs: input.suggestedAs,
      suggestedFromProductId: input.suggestedFromProductId,
      productId: product.id,
      siblingProductIds,
    });
  }

  // Throws if no DiscountRule governs this tier + category anywhere up the
  // tree — a missing rule is a business error, never a silent allowance.
  const rule = await getApplicableDiscountRule(tierId, product.categoryId);

  // A service (or combo) isn't stocked at all (see inventory.service.js's
  // assertWarehouseAndProduct) — no warehouse split makes sense for it, so
  // it gets no allocation rows regardless of what the client sent.
  const allocations =
    product.productType === 'GOODS' ? await resolveAllocations(product.id, input.quantity, input.allocations) : [];

  return {
    productId: product.id,
    quantity: input.quantity,
    unitPrice: toNumber(product.listPrice),
    discountPercent: input.discountPercent ?? 0,
    ceilingAtEntry: rule.maxDiscountPercent,
    taxRateAtEntry: toNumber(product.taxRate),
    isRecurring: input.isRecurring ?? false,
    recurringCycle: input.isRecurring ? input.recurringCycle : null,
    suggestedAs: input.suggestedAs ?? null,
    suggestedFromProductId: input.suggestedAs ? input.suggestedFromProductId : null,
    allocations: { create: allocations },
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
          // Carried forward, not re-decided: this line's origin story stays
          // true regardless of which quotation row it's attached to. Still
          // re-validated below like everything else in a requote copy (the
          // product itself is re-checked active too) — if the recommendation
          // has since been deactivated, that's worth surfacing, not hiding.
          suggestedAs: line.suggestedAs ?? undefined,
          suggestedFromProductId: line.suggestedFromProductId ?? undefined,
        }))
      : [];

  if (lineInputs.length === 0) throw ApiError.badRequest('lines must have at least one entry');

  // Each line's "siblings" are every OTHER product in this same batch —
  // known up front here since the whole quotation is created in one shot.
  const lineData = await Promise.all(
    lineInputs.map((input, index) =>
      buildLineData(
        customer.tierId,
        input,
        lineInputs.filter((_, i) => i !== index).map((line) => line.productId)
      )
    )
  );

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

  // Siblings for a new line = whatever will actually remain on the
  // quotation after this save: existing lines minus anything being removed,
  // plus every OTHER new line landing in this same batch.
  const removedLineIds = new Set(changes.remove ?? []);
  const remainingExistingProductIds = quotation.lines
    .filter((line) => !removedLineIds.has(line.id))
    .map((line) => line.productId);
  const addInputs = changes.add ?? [];

  const addLineData = await Promise.all(
    addInputs.map((input, index) => {
      const otherNewProductIds = addInputs.filter((_, i) => i !== index).map((line) => line.productId);
      return buildLineData(customer.tierId, input, [...remainingExistingProductIds, ...otherNewProductIds]);
    })
  );

  const changeCount =
    (changes.add?.length ?? 0) + (changes.update?.length ?? 0) + (changes.remove?.length ?? 0);

  // Resolved up front, outside the transaction, same reasoning as
  // addLineData above: a quantity change (or an explicit re-split) needs a
  // fresh allocation, and re-splitting requires knowing the line's product —
  // only available from the quotation already loaded here.
  const updateAllocations = {};
  for (const update of changes.update ?? []) {
    if (update.quantity === undefined && !update.allocations) continue;

    const existingLine = quotation.lines.find((line) => line.id === update.lineId);
    const product = await prisma.product.findUnique({ where: { id: existingLine.productId } });
    const quantity = update.quantity ?? existingLine.quantity;

    updateAllocations[update.lineId] =
      product.productType === 'GOODS' ? await resolveAllocations(product.id, quantity, update.allocations) : [];
  }

  await prisma.$transaction(async (tx) => {
    for (const lineId of changes.remove ?? []) {
      await tx.quotationLine.delete({ where: { id: lineId } });
    }

    for (const update of changes.update ?? []) {
      const { lineId, allocations: _allocationsInput, ...fields } = update;
      const data = {};
      if (fields.quantity !== undefined) data.quantity = fields.quantity;
      if (fields.discountPercent !== undefined) data.discountPercent = fields.discountPercent;
      if (fields.isRecurring !== undefined) data.isRecurring = fields.isRecurring;
      if (fields.recurringCycle !== undefined) data.recurringCycle = fields.recurringCycle;

      // Rows are replaced wholesale, never patched — a partial edit of a
      // multi-warehouse split has no sensible "diff" semantics.
      if (updateAllocations[lineId]) {
        await tx.quotationLineAllocation.deleteMany({ where: { quotationLineId: lineId } });
        data.allocations = { create: updateAllocations[lineId] };
      }

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

// Turns each line's already-chosen QuotationLineAllocation rows into real
// stock reservations — the one moment §1.5 says stock is actually promised.
// Re-checks availability against LIVE stock first (someone else may have
// consumed it since the split was chosen) and fails the whole confirm rather
// than silently re-splitting behind the rep's back if it no longer fits.
const reserveStockForQuotation = async (tx, quotationId) => {
  const lines = await tx.quotationLine.findMany({
    where: { quotationId },
    include: { allocations: true, product: { select: { sku: true } } },
  });

  for (const line of lines) {
    for (const allocation of line.allocations) {
      if (allocation.warehouseId == null) continue; // backorder — nothing to reserve

      const inventory = await tx.inventory.findUnique({
        where: { warehouseId_productId: { warehouseId: allocation.warehouseId, productId: line.productId } },
      });
      const available = inventory ? inventory.onHandQty - inventory.reservedQty : 0;

      if (available < allocation.quantity) {
        throw ApiError.badRequest(
          `Not enough stock to confirm: ${line.product.sku} needs ${allocation.quantity} from warehouse ${allocation.warehouseId} but only ${available} is available now. Re-open the line and adjust its warehouse split.`
        );
      }
    }
  }

  for (const line of lines) {
    for (const allocation of line.allocations) {
      if (allocation.warehouseId == null) continue;

      await tx.inventory.update({
        where: { warehouseId_productId: { warehouseId: allocation.warehouseId, productId: line.productId } },
        data: { reservedQty: { increment: allocation.quantity } },
      });

      await tx.stockMovement.create({
        data: {
          warehouseId: allocation.warehouseId,
          productId: line.productId,
          type: 'RESERVATION',
          reservedDelta: allocation.quantity,
          reason: `Reserved for ${displayCode(quotationId)}`,
        },
      });
    }
  }
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
      await reserveStockForQuotation(tx, quotation.id);
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
const recordCustomerDecision = async (quotationId, actingUser, note, targetStatus, auditAction) => {
  const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
  if (!quotation) throw ApiError.notFound(`No quotation with id ${quotationId}`);
  if (!CUSTOMER_DECISION_STATUSES.includes(quotation.status)) {
    throw ApiError.badRequest(`Cannot record this decision while the quotation is ${quotation.status}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.quotation.update({
      where: { id: quotationId },
      data: { status: targetStatus, lastActivityAt: new Date() },
    });
    await writeAudit(tx, { quotationId, userId: actingUser.id, action: auditAction, note });
  });

  return getQuotationById(quotationId, actingUser);
};

// The other path into CONFIRMED (besides routeQuotation's auto-confirm) —
// kept separate from recordCustomerDecision because this is the one customer
// decision that actually reserves stock (§1.5), via the same
// reserveStockForQuotation used on auto-confirm, so both paths into CONFIRMED
// can never reserve differently.
export const confirmQuotation = async (quotationId, actingUser, note) => {
  const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
  if (!quotation) throw ApiError.notFound(`No quotation with id ${quotationId}`);
  if (!CUSTOMER_DECISION_STATUSES.includes(quotation.status)) {
    throw ApiError.badRequest(`Cannot record this decision while the quotation is ${quotation.status}`);
  }

  await prisma.$transaction(async (tx) => {
    await reserveStockForQuotation(tx, quotationId);
    await tx.quotation.update({
      where: { id: quotationId },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), lastActivityAt: new Date() },
    });
    await writeAudit(tx, { quotationId, userId: actingUser.id, action: 'CONFIRMED', note });
  });

  return getQuotationById(quotationId, actingUser);
};

export const withdrawQuotation = (quotationId, actingUser, note) =>
  recordCustomerDecision(quotationId, actingUser, note, 'WITHDRAWN', 'WITHDRAWN');
