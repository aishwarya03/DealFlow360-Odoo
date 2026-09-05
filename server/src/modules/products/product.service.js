import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { marginPercent, toNumber } from '../../utils/money.js';

// Shapes a Product row for the API: Decimal columns become numbers, and the
// margin the rep watches is computed here rather than in the frontend, so every
// screen shows the same figure.
const toPublicProduct = (product) => {
  const listPrice = toNumber(product.listPrice);
  const costPrice = toNumber(product.costPrice);

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    category: product.category,
    unit: product.unit,
    isSubscribable: product.isSubscribable,
    listPrice,
    costPrice,
    taxRate: toNumber(product.taxRate),
    marginPercent: marginPercent(listPrice, costPrice),
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
};

export const listProducts = async (filters = {}) => {
  const where = {};

  // Inactive products stay out of every list unless explicitly asked for: a
  // discontinued product must not appear in the quotation builder.
  if (filters.includeInactive !== 'true') where.isActive = true;
  if (filters.category) where.category = filters.category;
  if (filters.isSubscribable) where.isSubscribable = filters.isSubscribable === 'true';

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { sku: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  return products.map(toPublicProduct);
};

export const getProductById = async (id) => {
  const product = await prisma.product.findUnique({ where: { id } });

  if (!product) throw ApiError.notFound(`No product with id ${id}`);

  return toPublicProduct(product);
};

export const createProduct = async (data) => {
  const existing = await prisma.product.findUnique({ where: { sku: data.sku } });

  if (existing) throw ApiError.conflict(`SKU ${data.sku} is already in use`);

  const product = await prisma.product.create({ data });

  return toPublicProduct(product);
};

export const updateProduct = async (id, data) => {
  const existing = await prisma.product.findUnique({ where: { id } });

  if (!existing) throw ApiError.notFound(`No product with id ${id}`);

  if (data.sku && data.sku !== existing.sku) {
    const clash = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (clash) throw ApiError.conflict(`SKU ${data.sku} is already in use`);
  }

  // A partial update can break the cost-vs-list rule using one new value against
  // one stored value, so the rule is re-checked on the merged result.
  const listPrice = data.listPrice ?? toNumber(existing.listPrice);
  const costPrice = data.costPrice ?? toNumber(existing.costPrice);

  if (costPrice > listPrice) {
    throw ApiError.badRequest('Update rejected', [
      { field: 'costPrice', message: 'Cost price cannot exceed list price' },
    ]);
  }

  const product = await prisma.product.update({ where: { id }, data });

  return toPublicProduct(product);
};

// Deactivation, not deletion: quotations and orders reference products, and
// history must stay readable after a product is withdrawn from sale.
export const deactivateProduct = async (id) => {
  const existing = await prisma.product.findUnique({ where: { id } });

  if (!existing) throw ApiError.notFound(`No product with id ${id}`);

  const product = await prisma.product.update({
    where: { id },
    data: { isActive: false },
  });

  return toPublicProduct(product);
};
