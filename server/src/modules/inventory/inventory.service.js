import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';

// available is derived here and nowhere else. It is never stored, so it can never
// disagree with the two numbers it comes from.
const availableOf = (row) => row.onHandQty - row.reservedQty;

const toPublicStock = (row) => ({
  id: row.id,
  warehouseId: row.warehouseId,
  productId: row.productId,
  warehouse: row.warehouse
    ? { id: row.warehouse.id, code: row.warehouse.code, name: row.warehouse.name }
    : undefined,
  product: row.product
    ? { id: row.product.id, sku: row.product.sku, name: row.product.name, unit: row.product.unit }
    : undefined,
  onHandQty: row.onHandQty,
  reservedQty: row.reservedQty,
  availableQty: availableOf(row),
  reorderPoint: row.reorderPoint,
  reorderQty: row.reorderQty,
  // A location is "below reorder point" on what it can still sell, not on what is
  // physically present: stock already promised to someone else cannot save you.
  needsReorder: availableOf(row) <= row.reorderPoint,
  updatedAt: row.updatedAt,
});

const withRelations = {
  warehouse: { select: { id: true, code: true, name: true } },
  product: { select: { id: true, sku: true, name: true, unit: true } },
};

// Both must exist and be active before stock can be recorded against them.
// Prisma would raise a foreign key error, but a 400 naming the missing side is
// far more useful than a driver message.
const assertWarehouseAndProduct = async (warehouseId, productId) => {
  const [warehouse, product] = await Promise.all([
    prisma.warehouse.findUnique({ where: { id: warehouseId } }),
    prisma.product.findUnique({ where: { id: productId } }),
  ]);

  if (!warehouse) throw ApiError.notFound(`No warehouse with id ${warehouseId}`);
  if (!product) throw ApiError.notFound(`No product with id ${productId}`);

  if (!warehouse.isActive) {
    throw ApiError.badRequest(`Warehouse ${warehouse.code} is deactivated`);
  }

  if (product.productType === 'SERVICE') {
    throw ApiError.badRequest(`${product.sku} is a service — services are not stocked`);
  }

  return { warehouse, product };
};

export const listStock = async (filters = {}) => {
  const where = {};

  if (filters.warehouseId) where.warehouseId = filters.warehouseId;
  if (filters.productId) where.productId = filters.productId;
  if (filters.inStockOnly === 'true') where.onHandQty = { gt: 0 };

  const rows = await prisma.inventory.findMany({
    where,
    include: withRelations,
    orderBy: [{ warehouseId: 'asc' }, { productId: 'asc' }],
  });

  const stock = rows.map(toPublicStock);

  // Filtered after mapping because needsReorder compares against available, which
  // is derived and so cannot be expressed as a Prisma where clause.
  return filters.lowStock === 'true' ? stock.filter((row) => row.needsReorder) : stock;
};

// The question the fulfillment split will ask: where can this product be found,
// and how much of it can actually be promised.
export const getAvailability = async (productId) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!product) throw ApiError.notFound(`No product with id ${productId}`);

  const rows = await prisma.inventory.findMany({
    where: { productId, warehouse: { isActive: true } },
    include: withRelations,
    // Cheapest dispatch first: the order a split would naturally draw stock in.
    orderBy: [
      { warehouse: { shippingCostPerShipment: 'asc' } },
      { warehouse: { priority: 'asc' } },
    ],
  });

  const locations = rows.map(toPublicStock);

  return {
    product: { id: product.id, sku: product.sku, name: product.name, unit: product.unit },
    totalOnHand: locations.reduce((sum, row) => sum + row.onHandQty, 0),
    totalReserved: locations.reduce((sum, row) => sum + row.reservedQty, 0),
    totalAvailable: locations.reduce((sum, row) => sum + row.availableQty, 0),
    // How many separate dispatches this product could involve if drawn from
    // everywhere. The split algorithm's job is to get this number down.
    stockedLocations: locations.filter((row) => row.availableQty > 0).length,
    locations,
  };
};

// Absolute set: "after a stocktake, this location holds exactly N".
export const setStock = async ({ warehouseId, productId, reason, ...levels }, userId) => {
  await assertWarehouseAndProduct(warehouseId, productId);

  const existing = await prisma.inventory.findUnique({
    where: { warehouseId_productId: { warehouseId, productId } },
  });

  // Setting on-hand below what is already promised would make available negative,
  // meaning stock has been sold that cannot be delivered.
  if (existing && levels.onHandQty < existing.reservedQty) {
    throw ApiError.badRequest(
      `Cannot set on-hand to ${levels.onHandQty}: ${existing.reservedQty} units are already reserved for confirmed orders`
    );
  }

  const previousOnHand = existing?.onHandQty ?? 0;

  // The row and its ledger entry are written together: a balance that changed
  // without a movement explaining it is exactly the state this table exists to
  // prevent, so either both land or neither does.
  const [row] = await prisma.$transaction([
    prisma.inventory.upsert({
      where: { warehouseId_productId: { warehouseId, productId } },
      update: levels,
      create: { warehouseId, productId, ...levels },
      include: withRelations,
    }),
    prisma.stockMovement.create({
      data: {
        warehouseId,
        productId,
        type: existing ? 'ADJUSTMENT' : 'RECEIPT',
        onHandDelta: levels.onHandQty - previousOnHand,
        reason: reason ?? (existing ? 'Stock level set' : 'Initial stock load'),
        userId,
      },
    }),
  ]);

  return toPublicStock(row);
};

// Signed change: "20 units arrived", "3 were damaged".
export const adjustStock = async ({ warehouseId, productId, delta, reason }, userId) => {
  await assertWarehouseAndProduct(warehouseId, productId);

  const existing = await prisma.inventory.findUnique({
    where: { warehouseId_productId: { warehouseId, productId } },
  });

  if (!existing) {
    throw ApiError.notFound(
      'No stock record for that product in that warehouse. Set an initial level first.'
    );
  }

  const newOnHand = existing.onHandQty + delta;

  if (newOnHand < 0) {
    throw ApiError.badRequest(
      `Cannot remove ${Math.abs(delta)}: only ${existing.onHandQty} on hand`
    );
  }

  if (newOnHand < existing.reservedQty) {
    throw ApiError.badRequest(
      `Cannot reduce on-hand to ${newOnHand}: ${existing.reservedQty} units are reserved for confirmed orders`
    );
  }

  const [row] = await prisma.$transaction([
    prisma.inventory.update({
      where: { warehouseId_productId: { warehouseId, productId } },
      data: { onHandQty: newOnHand },
      include: withRelations,
    }),
    prisma.stockMovement.create({
      data: {
        warehouseId,
        productId,
        type: delta > 0 ? 'RECEIPT' : 'ADJUSTMENT',
        onHandDelta: delta,
        reason,
        userId,
      },
    }),
  ]);

  return toPublicStock(row);
};

// The audit trail behind a balance: what changed, when, why, and who did it.
export const getMovements = async ({ warehouseId, productId, limit = 50 }) => {
  const where = {};
  if (warehouseId) where.warehouseId = warehouseId;
  if (productId) where.productId = productId;

  const movements = await prisma.stockMovement.findMany({
    where,
    include: { warehouse: { select: { id: true, code: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return movements.map((movement) => ({
    id: movement.id,
    warehouseId: movement.warehouseId,
    warehouse: movement.warehouse,
    productId: movement.productId,
    type: movement.type,
    onHandDelta: movement.onHandDelta,
    reservedDelta: movement.reservedDelta,
    reason: movement.reason,
    userId: movement.userId,
    createdAt: movement.createdAt,
  }));
};

// Everything at or below its reorder point, worst first — the restocking worklist.
export const getLowStock = async () => {
  const rows = await prisma.inventory.findMany({
    where: { warehouse: { isActive: true } },
    include: withRelations,
  });

  return rows
    .map(toPublicStock)
    .filter((row) => row.needsReorder)
    .sort((a, b) => a.availableQty - b.availableQty);
};
