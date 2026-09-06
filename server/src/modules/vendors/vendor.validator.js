import { z } from 'zod';

export const createVendorSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  address: z.string().trim().max(500).optional(),
  email: z.string().trim().email('Enter a valid email').optional(),
  phone: z.string().trim().max(30).optional(),
  website: z.string().trim().max(255).optional(),
  isActive: z.boolean().default(true),
});

export const updateVendorSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    address: z.string().trim().max(500).nullable().optional(),
    email: z.string().trim().email('Enter a valid email').nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    website: z.string().trim().max(255).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listVendorsSchema = z.object({
  search: z.string().trim().min(1).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});
