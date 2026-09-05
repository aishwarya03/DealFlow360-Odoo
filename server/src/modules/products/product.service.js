import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { getDescendantCategoryIds } from '../categories/category.service.js';
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
    productType: product.productType,
    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          parentId: product.category.parentId,
          // "Hardware / Computers" breadcrumb. The tree is shallow by
          // convention (admin-authored, not user data), so one parent hop is
          // enough — same assumption category.service.js's buildTree makes.
          path: product.category.parent
            ? `${product.category.parent.name} / ${product.category.name}`
            : product.category.name,
        }
      : { id: product.categoryId },
    unit: product.unit,
    imageUrl: product.imageUrl,
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

const withCategory = {
  category: {
    select: {
      id: true,
      name: true,
      parentId: true,
      parent: { select: { name: true } },
    },
  },
};

const assertCategoryExists = async (categoryId) => {
  if (categoryId === undefined) return;
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw ApiError.badRequest(`No category with id ${categoryId}`);
};

export const listProducts = async (filters = {}) => {
  const where = {};
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 12;

  // Inactive products stay out of every list unless explicitly asked for: a
  // discontinued product must not appear in the quotation builder.
  if (filters.includeInactive !== 'true') where.isActive = true;
  if (filters.productType) where.productType = filters.productType;
  if (filters.isSubscribable) where.isSubscribable = filters.isSubscribable === 'true';

  // Filtering by a parent category also matches its descendants — a product
  // filed under "Hardware > Computers" should still show up under "Hardware".
  if (filters.categoryId) {
    where.categoryId = { in: await getDescendantCategoryIds(filters.categoryId) };
  }

  if (filters.category) {
    where.category = {
      OR: [
        { name: { equals: filters.category, mode: 'insensitive' } },
        { parent: { name: { equals: filters.category, mode: 'insensitive' } } },
      ],
    };
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { sku: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: withCategory,
      orderBy: [{ name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: products.map(toPublicProduct),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const listPublicProducts = async (filters = {}) => {
  const result = await listProducts({ ...filters, includeInactive: 'false' });
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return {
    products: result.products.map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      productType: product.productType,
      category: product.category,
      unit: product.unit,
      imageUrl: product.imageUrl,
      isSubscribable: product.isSubscribable,
      listPrice: product.listPrice,
      taxRate: product.taxRate,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      price: product.listPrice,
      cycle: product.isSubscribable ? 'month' : null,
    })),
    categories,
    pagination: result.pagination,
  };
};

export const getProductById = async (id) => {
  const product = await prisma.product.findUnique({ where: { id }, include: withCategory });

  if (!product) throw ApiError.notFound(`No product with id ${id}`);

  return toPublicProduct(product);
};

export const createProduct = async (data) => {
  const existing = await prisma.product.findUnique({ where: { sku: data.sku } });
  if (existing) throw ApiError.conflict(`SKU ${data.sku} is already in use`);

  await assertCategoryExists(data.categoryId);

  const product = await prisma.product.create({ data, include: withCategory });

  return toPublicProduct(product);
};

export const updateProduct = async (id, data) => {
  const existing = await prisma.product.findUnique({ where: { id } });

  if (!existing) throw ApiError.notFound(`No product with id ${id}`);

  if (data.sku && data.sku !== existing.sku) {
    const clash = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (clash) throw ApiError.conflict(`SKU ${data.sku} is already in use`);
  }

  await assertCategoryExists(data.categoryId);

  // A partial update can break the cost-vs-list rule using one new value against
  // one stored value, so the rule is re-checked on the merged result.
  const listPrice = data.listPrice ?? toNumber(existing.listPrice);
  const costPrice = data.costPrice ?? toNumber(existing.costPrice);

  if (costPrice > listPrice) {
    throw ApiError.badRequest('Update rejected', [
      { field: 'costPrice', message: 'Cost price cannot exceed list price' },
    ]);
  }

  const product = await prisma.product.update({ where: { id }, data, include: withCategory });

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
    include: withCategory,
  });

  return toPublicProduct(product);
};

// Called by the upload route after multer has saved the new file to disk.
// Removes the product's previous image from disk when replacing one, so
// orphaned files don't accumulate under uploads/products. Silently ignores a
// missing old file — it may already be gone, or may be an external URL that
// was never a local upload in the first place.
export const setProductImage = async (id, imageUrl) => {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound(`No product with id ${id}`);

  const product = await prisma.product.update({
    where: { id },
    data: { imageUrl },
    include: withCategory,
  });

  if (existing.imageUrl?.startsWith('/uploads/products/')) {
    const { default: fs } = await import('fs/promises');
    const { default: path } = await import('path');
    const { UPLOAD_ROOT } = await import('../../middleware/uploadProductImage.js');
    const oldPath = path.join(UPLOAD_ROOT, path.basename(existing.imageUrl));
    await fs.unlink(oldPath).catch(() => {});
  }

  return toPublicProduct(product);
};
