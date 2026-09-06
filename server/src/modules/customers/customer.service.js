import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { toNumber } from '../../utils/money.js';
import { recalculateCustomerTier } from '../tiers/tierScoring.service.js';

// passwordHash must never leave this layer, even though it is null until the
// customer is granted portal access.
const toPublicCustomer = (customer) => ({
  id: customer.id,
  name: customer.name,
  email: customer.email,
  tierId: customer.tierId,
  tier: customer.tier
    ? { id: customer.tier.id, code: customer.tier.code, name: customer.tier.name }
    : undefined,
  tierScore: toNumber(customer.tierScore),
  tierCalculatedAt: customer.tierCalculatedAt,
  metrics: {
    totalPurchaseValue: toNumber(customer.totalPurchaseValue),
    completedOrders: customer.completedOrders,
    lastOrderAt: customer.lastOrderAt,
    customerSince: customer.customerSince,
  },
  contactName: customer.contactName,
  phone: customer.phone,
  address: customer.address,
  hasPortalAccess: Boolean(customer.passwordHash),
  isActive: customer.isActive,
  createdAt: customer.createdAt,
  updatedAt: customer.updatedAt,
});

const withTier = { tier: { select: { id: true, code: true, name: true } } };

// A customer row needs a tier before it can be scored, so it is created in
// the lowest band and immediately recalculated from its metrics.
const lowestTierId = async () => {
  const tier = await prisma.customerTier.findFirst({
    where: { isActive: true },
    orderBy: { minScore: 'asc' },
  });
  if (!tier) throw ApiError.badRequest('No active customer tiers are configured');

  return tier.id;
};

export const listCustomers = async (filters = {}) => {
  const where = {};

  if (filters.includeInactive !== 'true') where.isActive = true;
  if (filters.tierId) where.tierId = filters.tierId;

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    include: withTier,
    orderBy: { name: 'asc' },
  });

  return customers.map(toPublicCustomer);
};

export const getCustomerById = async (id) => {
  const customer = await prisma.customer.findUnique({ where: { id }, include: withTier });

  if (!customer) throw ApiError.notFound(`No customer with id ${id}`);

  return toPublicCustomer(customer);
};

export const createCustomer = async (data) => {
  const existing = await prisma.customer.findUnique({ where: { email: data.email } });

  if (existing) throw ApiError.conflict(`A customer with email ${data.email} already exists`);

  const created = await prisma.customer.create({
    data: { ...data, tierId: await lowestTierId() },
  });

  await recalculateCustomerTier(created.id);

  return getCustomerById(created.id);
};

export const updateCustomer = async (id, data) => {
  const existing = await prisma.customer.findUnique({ where: { id } });

  if (!existing) throw ApiError.notFound(`No customer with id ${id}`);

  if (data.email && data.email !== existing.email) {
    const clash = await prisma.customer.findUnique({ where: { email: data.email } });
    if (clash) throw ApiError.conflict(`A customer with email ${data.email} already exists`);
  }

  await prisma.customer.update({ where: { id }, data });

  // Any metric change moves the score, so the tier is re-derived rather than
  // left stale until someone remembers to run a batch.
  const touchedMetrics = ['totalPurchaseValue', 'completedOrders', 'lastOrderAt', 'customerSince'];
  if (touchedMetrics.some((field) => field in data)) {
    await recalculateCustomerTier(id);
  }

  return getCustomerById(id);
};

// Deactivation rather than deletion, for the same reason as products: quotations
// point at customers and that history has to stay intact.
export const deactivateCustomer = async (id) => {
  const existing = await prisma.customer.findUnique({ where: { id } });

  if (!existing) throw ApiError.notFound(`No customer with id ${id}`);

  const customer = await prisma.customer.update({
    where: { id },
    data: { isActive: false },
    include: withTier,
  });

  return toPublicCustomer(customer);
};
