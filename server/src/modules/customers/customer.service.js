import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';

// passwordHash must never leave this layer, even though it is null until the
// customer is granted portal access.
const toPublicCustomer = (customer) => ({
  id: customer.id,
  name: customer.name,
  email: customer.email,
  tier: customer.tier,
  contactName: customer.contactName,
  phone: customer.phone,
  hasPortalAccess: Boolean(customer.passwordHash),
  isActive: customer.isActive,
  createdAt: customer.createdAt,
  updatedAt: customer.updatedAt,
});

export const listCustomers = async (filters = {}) => {
  const where = {};

  if (filters.includeInactive !== 'true') where.isActive = true;
  if (filters.tier) where.tier = filters.tier;

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { name: 'asc' },
  });

  return customers.map(toPublicCustomer);
};

export const getCustomerById = async (id) => {
  const customer = await prisma.customer.findUnique({ where: { id } });

  if (!customer) throw ApiError.notFound(`No customer with id ${id}`);

  return toPublicCustomer(customer);
};

export const createCustomer = async (data) => {
  const existing = await prisma.customer.findUnique({ where: { email: data.email } });

  if (existing) throw ApiError.conflict(`A customer with email ${data.email} already exists`);

  const customer = await prisma.customer.create({ data });

  return toPublicCustomer(customer);
};

export const updateCustomer = async (id, data) => {
  const existing = await prisma.customer.findUnique({ where: { id } });

  if (!existing) throw ApiError.notFound(`No customer with id ${id}`);

  if (data.email && data.email !== existing.email) {
    const clash = await prisma.customer.findUnique({ where: { email: data.email } });
    if (clash) throw ApiError.conflict(`A customer with email ${data.email} already exists`);
  }

  const customer = await prisma.customer.update({ where: { id }, data });

  return toPublicCustomer(customer);
};

// Deactivation rather than deletion, for the same reason as products: quotations
// point at customers and that history has to stay intact.
export const deactivateCustomer = async (id) => {
  const existing = await prisma.customer.findUnique({ where: { id } });

  if (!existing) throw ApiError.notFound(`No customer with id ${id}`);

  const customer = await prisma.customer.update({
    where: { id },
    data: { isActive: false },
  });

  return toPublicCustomer(customer);
};
