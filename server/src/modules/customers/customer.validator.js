import { z } from 'zod';

const TIERS = ['BRONZE', 'SILVER', 'GOLD'];

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, 'Company name must be at least 2 characters'),
  email: z.string().trim().toLowerCase().email('Must be a valid email address'),
  // Tier decides the customer's default discount ceiling, so it is set
  // deliberately rather than inferred. Defaults to the most conservative tier.
  tier: z.enum(TIERS).default('BRONZE'),
  contactName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(5).max(30).optional(),
});

export const updateCustomerSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
    tier: z.enum(TIERS).optional(),
    contactName: z.string().trim().min(2).max(120).nullable().optional(),
    phone: z.string().trim().min(5).max(30).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listCustomersSchema = z.object({
  tier: z.enum(TIERS).optional(),
  search: z.string().trim().min(1).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});
