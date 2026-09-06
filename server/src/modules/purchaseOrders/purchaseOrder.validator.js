import { z } from 'zod';

// Creating a purchase order IS placing the backorder — see the model comment
// in schema.prisma. warehouseId names where the goods will land once the
// order is marked DONE.
export const createPurchaseOrderSchema = z.object({
  vendorId: z.number().int().positive('vendorId is required'),
  productId: z.number().int().positive('productId is required'),
  warehouseId: z.number().int().positive('warehouseId is required'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  notes: z.string().trim().max(1000).optional(),
});

export const updatePurchaseOrderSchema = z
  .object({
    vendorId: z.number().int().positive().optional(),
    quantity: z.number().int().positive().optional(),
    warehouseId: z.number().int().positive().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listPurchaseOrdersSchema = z.object({
  status: z.enum(['DRAFT', 'ORDERED', 'DONE', 'CANCELLED']).optional(),
  productId: z.coerce.number().int().positive().optional(),
  vendorId: z.coerce.number().int().positive().optional(),
});
