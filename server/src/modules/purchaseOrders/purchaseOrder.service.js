import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';

const withRelations = {
  vendor: { select: { id: true, name: true, email: true, phone: true } },
  product: { select: { id: true, sku: true, name: true, unit: true } },
  warehouse: { select: { id: true, code: true, name: true } },
};

const toPublicPurchaseOrder = (order) => ({
  id: order.id,
  vendorId: order.vendorId,
  vendor: order.vendor,
  productId: order.productId,
  product: order.product,
  warehouseId: order.warehouseId,
  warehouse: order.warehouse,
  quantity: order.quantity,
  status: order.status,
  notes: order.notes,
  orderedAt: order.orderedAt,
  completedAt: order.completedAt,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

const assertReferencesExist = async ({ vendorId, productId, warehouseId }) => {
  const [vendor, product, warehouse] = await Promise.all([
    vendorId !== undefined ? prisma.vendor.findUnique({ where: { id: vendorId } }) : undefined,
    productId !== undefined ? prisma.product.findUnique({ where: { id: productId } }) : undefined,
    warehouseId !== undefined
      ? prisma.warehouse.findUnique({ where: { id: warehouseId } })
      : undefined,
  ]);

  if (vendorId !== undefined && !vendor) throw ApiError.notFound(`No vendor with id ${vendorId}`);
  if (vendorId !== undefined && !vendor.isActive) throw ApiError.badRequest('Vendor is deactivated');
  if (productId !== undefined && !product) throw ApiError.notFound(`No product with id ${productId}`);
  if (productId !== undefined && product.productType === 'SERVICE') {
    throw ApiError.badRequest(`${product.sku} is a service — services are not stocked`);
  }
  if (warehouseId !== undefined && !warehouse) {
    throw ApiError.notFound(`No warehouse with id ${warehouseId}`);
  }
  if (warehouseId !== undefined && !warehouse.isActive) {
    throw ApiError.badRequest('Warehouse is deactivated');
  }
};

export const listPurchaseOrders = async (filters = {}) => {
  const where = {};

  if (filters.status) where.status = filters.status;
  if (filters.productId) where.productId = filters.productId;
  if (filters.vendorId) where.vendorId = filters.vendorId;

  const orders = await prisma.purchaseOrder.findMany({
    where,
    include: withRelations,
    orderBy: { createdAt: 'desc' },
  });

  return orders.map(toPublicPurchaseOrder);
};

export const getPurchaseOrderById = async (id) => {
  const order = await prisma.purchaseOrder.findUnique({ where: { id }, include: withRelations });

  if (!order) throw ApiError.notFound(`No purchase order with id ${id}`);

  return toPublicPurchaseOrder(order);
};

// Placing the backorder: creates the purchase order in DRAFT.
export const createPurchaseOrder = async (data) => {
  await assertReferencesExist(data);

  const order = await prisma.purchaseOrder.create({ data, include: withRelations });

  return toPublicPurchaseOrder(order);
};

export const updatePurchaseOrder = async (id, data) => {
  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });

  if (!existing) throw ApiError.notFound(`No purchase order with id ${id}`);
  if (existing.status !== 'DRAFT') {
    throw ApiError.badRequest('Only a DRAFT purchase order can be edited');
  }

  await assertReferencesExist(data);

  const order = await prisma.purchaseOrder.update({ where: { id }, data, include: withRelations });

  return toPublicPurchaseOrder(order);
};

// DRAFT -> ORDERED: the PO has actually been sent to the vendor.
export const markOrdered = async (id) => {
  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });

  if (!existing) throw ApiError.notFound(`No purchase order with id ${id}`);
  if (existing.status !== 'DRAFT') {
    throw ApiError.badRequest(`Cannot mark as ordered from status ${existing.status}`);
  }

  const order = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: 'ORDERED', orderedAt: new Date() },
    include: withRelations,
  });

  return toPublicPurchaseOrder(order);
};

// DRAFT or ORDERED -> DONE: goods received. This is the transition that
// advances the backorder to its final stage AND increases stock — the
// inventory row and its ledger entry are written in the same transaction as
// the status flip, so a purchase order can never end up DONE without the
// stock move that justifies it (same "balance + ledger together" rule as
// inventory.service.js).
export const markDone = async (id, userId) => {
  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });

  if (!existing) throw ApiError.notFound(`No purchase order with id ${id}`);
  if (existing.status !== 'DRAFT' && existing.status !== 'ORDERED') {
    throw ApiError.badRequest(`Cannot complete a purchase order from status ${existing.status}`);
  }

  const existingInventory = await prisma.inventory.findUnique({
    where: { warehouseId_productId: { warehouseId: existing.warehouseId, productId: existing.productId } },
  });

  const [order] = await prisma.$transaction([
    prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'DONE', completedAt: new Date() },
      include: withRelations,
    }),
    prisma.inventory.upsert({
      where: {
        warehouseId_productId: { warehouseId: existing.warehouseId, productId: existing.productId },
      },
      update: { onHandQty: { increment: existing.quantity } },
      create: {
        warehouseId: existing.warehouseId,
        productId: existing.productId,
        onHandQty: existing.quantity,
      },
    }),
    prisma.stockMovement.create({
      data: {
        warehouseId: existing.warehouseId,
        productId: existing.productId,
        type: 'RECEIPT',
        onHandDelta: existing.quantity,
        reason: `Purchase order #${existing.id} received${existingInventory ? '' : ' (new stock record)'}`,
        userId,
      },
    }),
  ]);

  return toPublicPurchaseOrder(order);
};

// Terminal, never deleted — same convention as REJECTED/WITHDRAWN quotations.
export const cancelPurchaseOrder = async (id) => {
  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });

  if (!existing) throw ApiError.notFound(`No purchase order with id ${id}`);
  if (existing.status === 'DONE' || existing.status === 'CANCELLED') {
    throw ApiError.badRequest(`Cannot cancel a purchase order from status ${existing.status}`);
  }

  const order = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: withRelations,
  });

  return toPublicPurchaseOrder(order);
};
