import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { round2, toNumber } from '../../utils/money.js';
import { getApplicableDiscountRule } from './discountRule.service.js';

/**
 * Approval levels, ordered. Kept as plain constants rather than a Prisma enum
 * because nothing persists a level yet — the ApprovalRequest / ApprovalStep
 * chain (docs/SOURCE_OF_TRUTH.md §1.3) arrives with the quotation slice, and
 * this becomes a stored enum then.
 */
export const APPROVAL_LEVEL = Object.freeze({
  NONE: 'NONE',
  MANAGER: 'MANAGER',
  MANAGER_FINANCE: 'MANAGER_FINANCE',
});

const LEVEL_RANK = { NONE: 0, MANAGER: 1, MANAGER_FINANCE: 2 };

const highestOf = (a, b) => (LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b);

/**
 * Evaluates a set of draft quotation lines against configured policy and
 * decides who, if anyone, has to approve.
 *
 * Every number it compares against comes from the database — DiscountRule for
 * per-line ceilings and thresholds, CustomerTier for the order-level ceiling.
 * Nothing here hardcodes a percentage.
 *
 * lines: [{ productId, quantity, discountPercent, unitPrice? }]
 *   unitPrice defaults to the product's current listPrice, so a caller can
 *   evaluate a quote before prices have been snapshotted onto lines.
 */
export const evaluateDiscount = async ({ customerId, lines }) => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { tier: true },
  });
  if (!customer) throw ApiError.notFound(`No customer with id ${customerId}`);

  const products = await prisma.product.findMany({
    where: { id: { in: lines.map((line) => line.productId) } },
    include: { category: { select: { id: true, name: true, parentId: true } } },
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  const evaluatedLines = [];
  let requiredLevel = APPROVAL_LEVEL.NONE;

  // Order-level running totals, per docs/SOURCE_OF_TRUTH.md §3.2 — weighted by
  // each line's value so a large compliant line cannot dilute a small
  // breaching one out of existence.
  let grossTotal = 0;
  let netTotal = 0;
  let weightedOverage = 0;

  for (const line of lines) {
    const product = productById.get(line.productId);
    if (!product) throw ApiError.badRequest(`No product with id ${line.productId}`);

    // Throws a clear business error if no rule governs this tier + category.
    const rule = await getApplicableDiscountRule(customer.tierId, product.categoryId);

    const unitPrice = line.unitPrice ?? toNumber(product.listPrice);
    const lineGross = round2(unitPrice * line.quantity);
    const lineNet = round2(lineGross * (1 - line.discountPercent / 100));

    const excessPercent = round2(Math.max(0, line.discountPercent - rule.maxDiscountPercent));

    // One rule, one question: is this line over its ceiling? If it is, the
    // quotation needs a Sales Manager. Finance is decided later, once the
    // whole order's blended score is known.
    const lineLevel = excessPercent > 0 ? APPROVAL_LEVEL.MANAGER : APPROVAL_LEVEL.NONE;

    requiredLevel = highestOf(requiredLevel, lineLevel);

    grossTotal += lineGross;
    netTotal += lineNet;
    weightedOverage += excessPercent * lineGross;

    evaluatedLines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      category: { id: product.category.id, name: product.category.name },
      quantity: line.quantity,
      unitPrice,
      lineTotal: lineGross,
      discountPercent: line.discountPercent,
      allowedDiscountPercent: rule.maxDiscountPercent,
      excessPercent,
      withinPolicy: excessPercent === 0,
      requiredLevel: lineLevel,
      rule: {
        id: rule.id,
        resolvedFromCategory: rule.resolvedFromCategoryName,
        inherited: rule.inherited,
        maxDiscountPercent: rule.maxDiscountPercent,
      },
    });
  }

  grossTotal = round2(grossTotal);
  netTotal = round2(netTotal);

  // The blended risk score: total overage weighted by line value, spread over
  // the whole order. This is what catches many small breaches that no single
  // line makes look alarming (brief §10), and it is what escalates a deal
  // from "a manager should see this" to "finance should see this too".
  const blendedSeverity = grossTotal > 0 ? round2(weightedOverage / grossTotal) : 0;

  const financeEscalationSeverity = toNumber(customer.tier.financeEscalationSeverity);
  if (blendedSeverity > financeEscalationSeverity) {
    requiredLevel = highestOf(requiredLevel, APPROVAL_LEVEL.MANAGER_FINANCE);
  }

  // §3.3 the compliant-but-heavy check: even when every line is individually
  // within its category ceiling, an order discounted past what the tier
  // intends should not sail through unseen. It can only escalate to MANAGER,
  // never further, because no line is actually broken.
  const orderDiscountPercent = grossTotal > 0 ? round2((1 - netTotal / grossTotal) * 100) : 0;
  const tierCeiling = toNumber(customer.tier.defaultMaxDiscountPercent);
  const anyLineBreached = evaluatedLines.some((line) => !line.withinPolicy);
  const orderLevelBreach = !anyLineBreached && orderDiscountPercent > tierCeiling;

  if (orderLevelBreach) {
    requiredLevel = highestOf(requiredLevel, APPROVAL_LEVEL.MANAGER);
  }

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      tier: { id: customer.tier.id, code: customer.tier.code, name: customer.tier.name },
    },
    approvalRequired: requiredLevel !== APPROVAL_LEVEL.NONE,
    approvalLevel: requiredLevel,
    // The chain a reviewer would walk, in order. Empty when nothing is needed.
    approvalChain:
      requiredLevel === APPROVAL_LEVEL.MANAGER_FINANCE
        ? ['SALES_MANAGER', 'FINANCE']
        : requiredLevel === APPROVAL_LEVEL.MANAGER
          ? ['SALES_MANAGER']
          : [],
    totals: {
      grossTotal,
      netTotal,
      discountTotal: round2(grossTotal - netTotal),
      orderDiscountPercent,
      tierCeilingPercent: tierCeiling,
    },
    risk: {
      blendedSeverity,
      financeEscalationSeverity,
      breachedLineCount: evaluatedLines.filter((line) => !line.withinPolicy).length,
      orderLevelBreach,
    },
    lines: evaluatedLines,
  };
};
