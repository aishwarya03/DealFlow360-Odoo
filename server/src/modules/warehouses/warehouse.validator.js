import { z } from 'zod';

export const createWarehouseSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, 'Code must be at least 2 characters')
    .max(20, 'Code must be 20 characters or fewer')
    .toUpperCase(),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  city: z.string().trim().min(2).max(80).optional(),
  shippingCostPerShipment: z
    .number({ message: 'Shipping cost must be a number' })
    .nonnegative('Shipping cost cannot be negative')
    .max(99999999.99, 'Shipping cost is too large')
    .default(0),
  priority: z
    .number()
    .int('Priority must be a whole number')
    .min(1, 'Priority must be at least 1')
    .max(999, 'Priority must be 999 or less')
    .default(100),
});

export const updateWarehouseSchema = z
  .object({
    code: z.string().trim().min(2).max(20).toUpperCase().optional(),
    name: z.string().trim().min(2).optional(),
    city: z.string().trim().min(2).max(80).nullable().optional(),
    shippingCostPerShipment: z.number().nonnegative().max(99999999.99).optional(),
    priority: z.number().int().min(1).max(999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listWarehousesSchema = z.object({
  search: z.string().trim().min(1).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});
