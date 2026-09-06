import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';

const toPublicVendor = (vendor) => ({
  id: vendor.id,
  name: vendor.name,
  address: vendor.address,
  email: vendor.email,
  phone: vendor.phone,
  website: vendor.website,
  isActive: vendor.isActive,
  createdAt: vendor.createdAt,
  updatedAt: vendor.updatedAt,
});

export const listVendors = async (filters = {}) => {
  const where = {};

  if (filters.includeInactive !== 'true') where.isActive = true;

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const vendors = await prisma.vendor.findMany({ where, orderBy: { name: 'asc' } });

  return vendors.map(toPublicVendor);
};

export const getVendorById = async (id) => {
  const vendor = await prisma.vendor.findUnique({ where: { id } });

  if (!vendor) throw ApiError.notFound(`No vendor with id ${id}`);

  return toPublicVendor(vendor);
};

export const createVendor = async (data) => {
  const vendor = await prisma.vendor.create({ data });

  return toPublicVendor(vendor);
};

export const updateVendor = async (id, data) => {
  const existing = await prisma.vendor.findUnique({ where: { id } });

  if (!existing) throw ApiError.notFound(`No vendor with id ${id}`);

  const vendor = await prisma.vendor.update({ where: { id }, data });

  return toPublicVendor(vendor);
};

// Deactivation, not deletion — products and purchase orders reference a
// vendor, and that history must stay readable after a vendor is dropped.
export const deactivateVendor = async (id) => {
  const existing = await prisma.vendor.findUnique({ where: { id } });

  if (!existing) throw ApiError.notFound(`No vendor with id ${id}`);

  const vendor = await prisma.vendor.update({ where: { id }, data: { isActive: false } });

  return toPublicVendor(vendor);
};
