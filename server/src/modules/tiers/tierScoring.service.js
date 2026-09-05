import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { round2, toNumber } from '../../utils/money.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Every metric scores as a 0..1 ratio against a configured target, then takes
// its share of the 100 points. Ratios are capped at 1 so an exceptional
// customer cannot score above the weight and skew the total.
const ratio = (value, target) => {
  if (!target || target <= 0) return 0;
  return Math.min(1, Math.max(0, value / target));
};

export const getScoringConfig = async () => {
  // Singleton: created on first read so the engine works on a fresh database
  // without a separate bootstrap step.
  const config = await prisma.tierScoringConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  return {
    purchaseValueWeight: toNumber(config.purchaseValueWeight),
    orderCountWeight: toNumber(config.orderCountWeight),
    recencyWeight: toNumber(config.recencyWeight),
    relationshipWeight: toNumber(config.relationshipWeight),
    purchaseValueTarget: toNumber(config.purchaseValueTarget),
    orderCountTarget: config.orderCountTarget,
    recencyHorizonDays: config.recencyHorizonDays,
    relationshipTargetYears: toNumber(config.relationshipTargetYears),
    updatedAt: config.updatedAt,
  };
};

export const updateScoringConfig = async (data) => {
  const current = await getScoringConfig();
  const merged = { ...current, ...data };

  const weightTotal =
    merged.purchaseValueWeight +
    merged.orderCountWeight +
    merged.recencyWeight +
    merged.relationshipWeight;

  // Weights that don't total 100 would silently change what a "score out of
  // 100" means, and every band boundary with it.
  if (round2(weightTotal) !== 100) {
    throw ApiError.badRequest('Update rejected', [
      {
        field: 'purchaseValueWeight',
        message: `The four weights must total 100 (currently ${round2(weightTotal)})`,
      },
    ]);
  }

  await prisma.tierScoringConfig.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });

  return getScoringConfig();
};

/**
 * Scores one customer 0-100 from their four metrics and returns the breakdown
 * alongside the tier they land in — the "38/40, 21/25, 17/20, 12/15" view.
 *
 * Pure calculation against config: it reads, it does not write.
 */
export const scoreCustomer = async (customer, config, tiers) => {
  const now = Date.now();

  const purchaseValue = toNumber(customer.totalPurchaseValue);
  const daysSinceLastOrder = customer.lastOrderAt
    ? Math.max(0, Math.floor((now - new Date(customer.lastOrderAt).getTime()) / DAY_MS))
    : null;
  const relationshipYears =
    (now - new Date(customer.customerSince).getTime()) / (365.25 * DAY_MS);

  // Recency runs backwards: a recent order scores high and decays to zero at
  // the horizon. A customer who has never ordered scores nothing here.
  const recencyRatio =
    daysSinceLastOrder === null
      ? 0
      : Math.max(0, 1 - daysSinceLastOrder / config.recencyHorizonDays);

  const components = [
    {
      key: 'purchaseValue',
      label: 'Total purchase value',
      value: purchaseValue,
      target: config.purchaseValueTarget,
      weight: config.purchaseValueWeight,
      earned: round2(ratio(purchaseValue, config.purchaseValueTarget) * config.purchaseValueWeight),
    },
    {
      key: 'orderCount',
      label: 'Completed orders',
      value: customer.completedOrders,
      target: config.orderCountTarget,
      weight: config.orderCountWeight,
      earned: round2(
        ratio(customer.completedOrders, config.orderCountTarget) * config.orderCountWeight
      ),
    },
    {
      key: 'recency',
      label: 'Recent purchase activity',
      value: daysSinceLastOrder,
      target: config.recencyHorizonDays,
      weight: config.recencyWeight,
      earned: round2(recencyRatio * config.recencyWeight),
    },
    {
      key: 'relationship',
      label: 'Customer relationship duration',
      value: round2(relationshipYears),
      target: config.relationshipTargetYears,
      weight: config.relationshipWeight,
      earned: round2(
        ratio(relationshipYears, config.relationshipTargetYears) * config.relationshipWeight
      ),
    },
  ];

  const score = round2(components.reduce((sum, c) => sum + c.earned, 0));

  // Highest band the score reaches. Tiers are sorted ascending by minScore,
  // so the last one still at or below the score wins.
  const banded = [...tiers].sort((a, b) => a.minScore - b.minScore);
  const tier = banded.reduce((best, t) => (score >= t.minScore ? t : best), banded[0]);

  if (!tier) throw ApiError.badRequest('No active customer tiers are configured');

  return { score, tier, components };
};

const loadInputs = async () => {
  const [config, tiers] = await Promise.all([
    getScoringConfig(),
    prisma.customerTier.findMany({ where: { isActive: true } }),
  ]);

  if (!tiers.length) throw ApiError.badRequest('No active customer tiers are configured');

  return { config, tiers };
};

/** Breakdown for one customer, without writing anything. */
export const getCustomerTierScore = async (customerId) => {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { tier: true },
  });
  if (!customer) throw ApiError.notFound(`No customer with id ${customerId}`);

  const { config, tiers } = await loadInputs();
  const { score, tier, components } = await scoreCustomer(customer, config, tiers);

  return {
    customer: { id: customer.id, name: customer.name },
    metrics: {
      totalPurchaseValue: toNumber(customer.totalPurchaseValue),
      completedOrders: customer.completedOrders,
      lastOrderAt: customer.lastOrderAt,
      customerSince: customer.customerSince,
    },
    components,
    score,
    currentTier: { id: customer.tier.id, code: customer.tier.code },
    calculatedTier: { id: tier.id, code: tier.code, name: tier.name, minScore: tier.minScore },
    changed: customer.tierId !== tier.id,
  };
};

/** Scores a customer and persists the result. */
export const recalculateCustomerTier = async (customerId) => {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw ApiError.notFound(`No customer with id ${customerId}`);

  const { config, tiers } = await loadInputs();
  const { score, tier, components } = await scoreCustomer(customer, config, tiers);

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { tierId: tier.id, tierScore: score, tierCalculatedAt: new Date() },
    include: { tier: true },
  });

  return {
    customerId: updated.id,
    name: updated.name,
    score,
    previousTierId: customer.tierId,
    tier: { id: updated.tier.id, code: updated.tier.code, name: updated.tier.name },
    changed: customer.tierId !== tier.id,
    components,
  };
};

/** Re-scores every active customer — the batch an admin runs after changing config. */
export const recalculateAllTiers = async () => {
  const { config, tiers } = await loadInputs();
  const customers = await prisma.customer.findMany({ where: { isActive: true } });

  const results = [];
  for (const customer of customers) {
    const { score, tier } = await scoreCustomer(customer, config, tiers);

    await prisma.customer.update({
      where: { id: customer.id },
      data: { tierId: tier.id, tierScore: score, tierCalculatedAt: new Date() },
    });

    results.push({
      customerId: customer.id,
      name: customer.name,
      score,
      tier: tier.code,
      changed: customer.tierId !== tier.id,
    });
  }

  return { evaluated: results.length, changed: results.filter((r) => r.changed).length, results };
};
