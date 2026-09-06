import { z } from 'zod';

// Tier is never accepted as input — it is calculated from the metrics below
// by the tier scoring engine. A new customer with no history scores 0 and
// lands in the lowest band.
const metrics = {
  totalPurchaseValue: z.number().nonnegative().max(999999999999).optional(),
  completedOrders: z.number().int().nonnegative().max(1000000).optional(),
  lastOrderAt: z.coerce.date().nullable().optional(),
  customerSince: z.coerce.date().optional(),
};

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Company name must be at least 2 characters'),
  email: z.string().trim().toLowerCase().email('Must be a valid email address'),
  contactName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(5).max(30).optional(),
  address: z.string().trim().max(300).optional(),
  ...metrics,
});

export const updateCustomerSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    contactName: z.string().trim().min(2).max(120).nullable().optional(),
    phone: z.string().trim().min(5).max(30).nullable().optional(),
    address: z.string().trim().max(300).nullable().optional(),
    isActive: z.boolean().optional(),
    ...metrics,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listCustomersSchema = z.object({
  tierId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().min(1).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});
