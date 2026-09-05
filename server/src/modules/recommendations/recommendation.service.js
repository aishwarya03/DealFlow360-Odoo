import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { marginPercent, toNumber } from '../../utils/money.js';

const withProducts = {
  source: { select: { id: true, sku: true, name: true } },
  target: { select: { id: true, sku: true, name: true } },
};

const toPublicRecommendation = (row) => ({
  id: row.id,
  sourceProductId: row.sourceProductId,
  source: row.source ? { id: row.source.id, sku: row.source.sku, name: row.source.name } : undefined,
  targetProductId: row.targetProductId,
  target: row.target ? { id: row.target.id, sku: row.target.sku, name: row.target.name } : undefined,
  type: row.type,
  promoted: row.promoted,
  minMarginPercent: toNumber(row.minMarginPercent),
  isActive: row.isActive,
  createdAt: row.createdAt,
});

export const listRecommendations = async (filters = {}) => {
  const where = {};
  if (filters.sourceProductId) where.sourceProductId = filters.sourceProductId;
  if (filters.targetProductId) where.targetProductId = filters.targetProductId;
  if (filters.type) where.type = filters.type;
  if (filters.includeInactive !== 'true') where.isActive = true;

  const rows = await prisma.productRecommendation.findMany({
    where,
    include: withProducts,
    orderBy: { createdAt: 'desc' },
  });

  return rows.map(toPublicRecommendation);
};

export const getRecommendationById = async (id) => {
  const row = await prisma.productRecommendation.findUnique({ where: { id }, include: withProducts });
  if (!row) throw ApiError.notFound(`No recommendation with id ${id}`);

  return toPublicRecommendation(row);
};

const assertProductsExist = async (sourceProductId, targetProductId) => {
  const [source, target] = await Promise.all([
    prisma.product.findUnique({ where: { id: sourceProductId } }),
    prisma.product.findUnique({ where: { id: targetProductId } }),
  ]);
  if (!source) throw ApiError.badRequest(`No product with id ${sourceProductId}`);
  if (!target) throw ApiError.badRequest(`No product with id ${targetProductId}`);
};

export const createRecommendation = async (data) => {
  await assertProductsExist(data.sourceProductId, data.targetProductId);

  const clash = await prisma.productRecommendation.findUnique({
    where: {
      sourceProductId_targetProductId_type: {
        sourceProductId: data.sourceProductId,
        targetProductId: data.targetProductId,
        type: data.type,
      },
    },
    include: withProducts,
  });
  if (clash) {
    throw ApiError.conflict(
      `A ${data.type} recommendation from ${clash.source.sku} to ${clash.target.sku} already exists (id ${clash.id})`
    );
  }

  const row = await prisma.productRecommendation.create({ data, include: withProducts });
  return toPublicRecommendation(row);
};

export const updateRecommendation = async (id, data) => {
  const existing = await prisma.productRecommendation.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound(`No recommendation with id ${id}`);

  const row = await prisma.productRecommendation.update({ where: { id }, data, include: withProducts });
  return toPublicRecommendation(row);
};

// Deactivation, not deletion — consistent with every other admin-configured
// table in this schema, even though nothing here actually depends on the
// row surviving (see the schema comment on ProductRecommendation.isActive).
export const deactivateRecommendation = async (id) => {
  const existing = await prisma.productRecommendation.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound(`No recommendation with id ${id}`);

  const row = await prisma.productRecommendation.update({
    where: { id },
    data: { isActive: false },
    include: withProducts,
  });
  return toPublicRecommendation(row);
};

/**
 * The suggestion engine: given every product currently in an order (a
 * quotation's lines, or a cart), return everything those products point at
 * that isn't already in that same set.
 *
 * includeMargin gates cost/margin-derived fields entirely — the public
 * (customer-facing) caller must never receive them (access matrix §6:
 * margin is staff-only, never portal-facing). Same evaluation, two shapes.
 */
export const getSuggestions = async (productIds, { includeMargin = true } = {}) => {
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) return [];

  const rows = await prisma.productRecommendation.findMany({
    where: {
      sourceProductId: { in: uniqueIds },
      targetProductId: { notIn: uniqueIds },
      isActive: true,
    },
    include: {
      source: { select: { id: true, sku: true, name: true } },
      target: true,
    },
    // Promoted first, then oldest-configured — a stable, predictable order
    // rather than one that shuffles as unrelated rows are added elsewhere.
    orderBy: [{ promoted: 'desc' }, { createdAt: 'asc' }],
  });

  const suggestions = [];
  const seenTargets = new Set();

  for (const row of rows) {
    if (!row.target.isActive) continue; // never suggest a discontinued product
    if (seenTargets.has(row.targetProductId)) continue; // one card per target; first (promoted-first) wins

    const targetListPrice = toNumber(row.target.listPrice);
    const targetCostPrice = toNumber(row.target.costPrice);
    const targetMargin = marginPercent(targetListPrice, targetCostPrice);

    // This pairing's own threshold — don't surface it if the target's
    // margin has eroded below what makes it worth suggesting.
    if (targetMargin < toNumber(row.minMarginPercent)) continue;

    seenTargets.add(row.targetProductId);

    suggestions.push({
      recommendationId: row.id,
      type: row.type,
      promoted: row.promoted,
      // The product already in the order that earns this suggestion — the
      // exact id a caller sends back as suggestedFromProductId when it
      // accepts the suggestion (see quotation.service.js's buildLineData).
      triggeredBy: { id: row.source.id, sku: row.source.sku, name: row.source.name },
      product: {
        id: row.target.id,
        sku: row.target.sku,
        name: row.target.name,
        listPrice: targetListPrice,
        taxRate: toNumber(row.target.taxRate),
        isSubscribable: row.target.isSubscribable,
        productType: row.target.productType,
        imageUrl: row.target.imageUrl,
        ...(includeMargin ? { costPrice: targetCostPrice, marginPercent: targetMargin } : {}),
      },
    });
  }

  return suggestions;
};

// Used by quotation.service.js to verify a client's suggestedAs/
// suggestedFromProductId claim is real, not just asserted — see the comment
// on buildLineData for why this matters (untrusted client input feeding a
// field that reporting will eventually rely on).
export const findActiveRecommendation = (sourceProductId, targetProductId, type) =>
  prisma.productRecommendation.findFirst({
    where: { sourceProductId, targetProductId, type, isActive: true },
  });
