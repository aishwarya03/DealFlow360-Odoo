import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { toNumber } from '../../utils/money.js';

const toPublicWarehouse = (warehouse) => ({
  id: warehouse.id,
  code: warehouse.code,
  name: warehouse.name,
  city: warehouse.city,
  shippingCostPerShipment: toNumber(warehouse.shippingCostPerShipment),
  priority: warehouse.priority,
  isActive: warehouse.isActive,
  createdAt: warehouse.createdAt,
  updatedAt: warehouse.updatedAt,
});

export const listWarehouses = async (filters = {}) => {
  const where = {};

  if (filters.includeInactive !== 'true') where.isActive = true;

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { code: { contains: filters.search, mode: 'insensitive' } },
      { city: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const warehouses = await prisma.warehouse.findMany({
    where,
    // The order the split algorithm will consider them in: cheapest dispatch
    // first, priority as the tie-break.
    orderBy: [{ shippingCostPerShipment: 'asc' }, { priority: 'asc' }],
  });

  return warehouses.map(toPublicWarehouse);
};

export const getWarehouseById = async (id) => {
  const warehouse = await prisma.warehouse.findUnique({ where: { id } });

  if (!warehouse) throw ApiError.notFound(`No warehouse with id ${id}`);

  return toPublicWarehouse(warehouse);
};

export const createWarehouse = async (data) => {
  const existing = await prisma.warehouse.findUnique({ where: { code: data.code } });

  if (existing) throw ApiError.conflict(`Warehouse code ${data.code} is already in use`);

  const warehouse = await prisma.warehouse.create({ data });

  return toPublicWarehouse(warehouse);
};

export const updateWarehouse = async (id, data) => {
  const existing = await prisma.warehouse.findUnique({ where: { id } });

  if (!existing) throw ApiError.notFound(`No warehouse with id ${id}`);

  if (data.code && data.code !== existing.code) {
    const clash = await prisma.warehouse.findUnique({ where: { code: data.code } });
    if (clash) throw ApiError.conflict(`Warehouse code ${data.code} is already in use`);
  }

  const warehouse = await prisma.warehouse.update({ where: { id }, data });

  return toPublicWarehouse(warehouse);
};

// Deactivation, not deletion — stock movements reference the warehouse and that
// history must survive. A deactivated warehouse is also refused below if it still
// holds stock, because hiding a location that physically contains goods turns a
// reporting problem into a lost-inventory problem.
export const deactivateWarehouse = async (id) => {
  const existing = await prisma.warehouse.findUnique({ where: { id } });

  if (!existing) throw ApiError.notFound(`No warehouse with id ${id}`);

  const stillStocked = await prisma.inventory.aggregate({
    where: { warehouseId: id },
    _sum: { onHandQty: true, reservedQty: true },
  });

  const onHand = stillStocked._sum.onHandQty ?? 0;
  const reserved = stillStocked._sum.reservedQty ?? 0;

  if (onHand > 0 || reserved > 0) {
    throw ApiError.badRequest(
      `Cannot deactivate: ${existing.code} still holds ${onHand} on hand and ${reserved} reserved. Move or write off the stock first.`
    );
  }

  const warehouse = await prisma.warehouse.update({
    where: { id },
    data: { isActive: false },
  });

  return toPublicWarehouse(warehouse);
};
