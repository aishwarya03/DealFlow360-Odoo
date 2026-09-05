import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { toNumber } from '../../utils/money.js';

const toPublicTier = (tier) => ({
  id: tier.id,
  code: tier.code,
  name: tier.name,
  rank: tier.rank,
  defaultMaxDiscountPercent: toNumber(tier.defaultMaxDiscountPercent),
  financeEscalationSeverity: toNumber(tier.financeEscalationSeverity),
  customerCount: tier._count?.customers,
  ruleCount: tier._count?.discountRules,
  isActive: tier.isActive,
  createdAt: tier.createdAt,
  updatedAt: tier.updatedAt,
});

const withCounts = { _count: { select: { customers: true, discountRules: true } } };

export const listTiers = async (filters = {}) => {
  const where = {};
  if (filters.includeInactive !== 'true') where.isActive = true;

  const tiers = await prisma.customerTier.findMany({
    where,
    include: withCounts,
    orderBy: { rank: 'asc' },
  });

  return tiers.map(toPublicTier);
};

export const getTierById = async (id) => {
  const tier = await prisma.customerTier.findUnique({ where: { id }, include: withCounts });
  if (!tier) throw ApiError.notFound(`No customer tier with id ${id}`);

  return toPublicTier(tier);
};

const assertCodeAndRankFree = async (code, rank, exceptId) => {
  if (code) {
    const clash = await prisma.customerTier.findFirst({
      where: { code, NOT: exceptId ? { id: exceptId } : undefined },
    });
    if (clash) throw ApiError.conflict(`A tier with code ${code} already exists`);
  }
  if (rank !== undefined) {
    const clash = await prisma.customerTier.findFirst({
      where: { rank, NOT: exceptId ? { id: exceptId } : undefined },
    });
    if (clash) throw ApiError.conflict(`Rank ${rank} is already used by tier ${clash.code}`);
  }
};

export const createTier = async (data) => {
  await assertCodeAndRankFree(data.code, data.rank);

  const tier = await prisma.customerTier.create({ data, include: withCounts });

  return toPublicTier(tier);
};

export const updateTier = async (id, data) => {
  const existing = await prisma.customerTier.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound(`No customer tier with id ${id}`);

  await assertCodeAndRankFree(data.code, data.rank, id);

  const tier = await prisma.customerTier.update({ where: { id }, data, include: withCounts });

  return toPublicTier(tier);
};

// Deactivation, and only when nothing points at it — a tier still assigned to
// customers is the ceiling their quotes are judged against, so hiding it
// would leave those customers with no resolvable policy.
export const deactivateTier = async (id) => {
  const tier = await prisma.customerTier.findUnique({ where: { id }, include: withCounts });
  if (!tier) throw ApiError.notFound(`No customer tier with id ${id}`);

  if (tier._count.customers > 0) {
    throw ApiError.badRequest(
      `Cannot deactivate ${tier.code}: ${tier._count.customers} customers are on this tier. Move them first.`
    );
  }

  const updated = await prisma.customerTier.update({
    where: { id },
    data: { isActive: false },
    include: withCounts,
  });

  return toPublicTier(updated);
};
