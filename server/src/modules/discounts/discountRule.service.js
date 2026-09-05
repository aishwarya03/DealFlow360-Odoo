import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { toNumber } from '../../utils/money.js';

const toPublicRule = (rule) => ({
  id: rule.id,
  customerTierId: rule.customerTierId,
  customerTier: rule.customerTier
    ? { id: rule.customerTier.id, code: rule.customerTier.code, name: rule.customerTier.name }
    : undefined,
  categoryId: rule.categoryId,
  category: rule.category
    ? { id: rule.category.id, name: rule.category.name, parentId: rule.category.parentId }
    : undefined,
  maxDiscountPercent: toNumber(rule.maxDiscountPercent),
  isActive: rule.isActive,
  createdAt: rule.createdAt,
  updatedAt: rule.updatedAt,
});

const withRelations = {
  customerTier: { select: { id: true, code: true, name: true } },
  category: { select: { id: true, name: true, parentId: true } },
};

export const listRules = async (filters = {}) => {
  const where = {};
  if (filters.customerTierId) where.customerTierId = filters.customerTierId;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.includeInactive !== 'true') where.isActive = true;

  const rules = await prisma.discountRule.findMany({
    where,
    include: withRelations,
    orderBy: [{ customerTier: { rank: 'desc' } }, { category: { name: 'asc' } }],
  });

  return rules.map(toPublicRule);
};

export const getRuleById = async (id) => {
  const rule = await prisma.discountRule.findUnique({ where: { id }, include: withRelations });
  if (!rule) throw ApiError.notFound(`No discount rule with id ${id}`);

  return toPublicRule(rule);
};

const assertRefsExist = async (customerTierId, categoryId) => {
  if (customerTierId !== undefined) {
    const tier = await prisma.customerTier.findUnique({ where: { id: customerTierId } });
    if (!tier) throw ApiError.badRequest(`No customer tier with id ${customerTierId}`);
  }
  if (categoryId !== undefined) {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw ApiError.badRequest(`No category with id ${categoryId}`);
  }
};

export const createRule = async (data) => {
  await assertRefsExist(data.customerTierId, data.categoryId);

  const clash = await prisma.discountRule.findUnique({
    where: {
      customerTierId_categoryId: {
        customerTierId: data.customerTierId,
        categoryId: data.categoryId,
      },
    },
    include: withRelations,
  });

  if (clash) {
    throw ApiError.conflict(
      `A rule already exists for ${clash.customerTier.code} + ${clash.category.name} (rule ${clash.id}). Edit that rule instead of adding a second one.`
    );
  }

  const rule = await prisma.discountRule.create({ data, include: withRelations });

  return toPublicRule(rule);
};

export const updateRule = async (id, data) => {
  const existing = await prisma.discountRule.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound(`No discount rule with id ${id}`);

  await assertRefsExist(data.customerTierId, data.categoryId);

  const rule = await prisma.discountRule.update({ where: { id }, data, include: withRelations });

  return toPublicRule(rule);
};

// Deactivation, not deletion: a rule is policy, and policy that governed a
// past quotation must stay readable. A deactivated rule stops resolving,
// which surfaces as a loud validation error rather than a silent allowance.
export const deactivateRule = async (id) => {
  const existing = await prisma.discountRule.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound(`No discount rule with id ${id}`);

  const rule = await prisma.discountRule.update({
    where: { id },
    data: { isActive: false },
    include: withRelations,
  });

  return toPublicRule(rule);
};

/**
 * The core resolution the brief asks for: given a customer tier and the
 * category a product sits in, find the active rule that governs it.
 *
 * Categories are a tree, and products are usually filed on a leaf
 * ("Hardware / Computers") while policy is written at the level people think
 * in ("Hardware"). So resolution walks UP the ancestry from the product's own
 * category and returns the first active rule it meets — the nearest, most
 * specific policy wins, and a broad rule at the root still governs everything
 * beneath it.
 *
 * Throws when nothing matches anywhere up the chain. That is deliberate: the
 * brief requires a missing rule to be a business error, never a silent
 * allowance, because "no rule" must never read as "no limit".
 */
export const getApplicableDiscountRule = async (customerTierId, categoryId) => {
  const tier = await prisma.customerTier.findUnique({ where: { id: customerTierId } });
  if (!tier) throw ApiError.badRequest(`No customer tier with id ${customerTierId}`);

  const startCategory = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!startCategory) throw ApiError.badRequest(`No category with id ${categoryId}`);

  const visited = [];
  let cursor = startCategory;

  while (cursor) {
    visited.push(cursor.name);

    const rule = await prisma.discountRule.findFirst({
      where: { customerTierId, categoryId: cursor.id, isActive: true },
      include: withRelations,
    });

    if (rule) {
      return {
        ...toPublicRule(rule),
        // Tells the caller whether policy was found on the product's own
        // category or inherited from an ancestor — worth surfacing so an
        // admin can see why a given ceiling applied.
        resolvedFromCategoryId: cursor.id,
        resolvedFromCategoryName: cursor.name,
        inherited: cursor.id !== startCategory.id,
      };
    }

    cursor = cursor.parentId
      ? await prisma.category.findUnique({ where: { id: cursor.parentId } })
      : null;
  }

  throw ApiError.badRequest(
    `No active discount rule for tier ${tier.code} in category "${startCategory.name}". Checked: ${visited.join(' -> ')}. Configure a rule before discounting this product.`
  );
};
