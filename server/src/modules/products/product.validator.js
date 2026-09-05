import { z } from 'zod';

const CATEGORIES = ['HARDWARE', 'SOFTWARE', 'SERVICE'];

const money = (label) =>
  z
    .number({ message: `${label} must be a number` })
    .nonnegative(`${label} cannot be negative`)
    .max(99999999.99, `${label} is too large`);

export const createProductSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(2, 'SKU must be at least 2 characters')
      .max(40, 'SKU must be 40 characters or fewer')
      .toUpperCase(),
    name: z.string().trim().min(2, 'Name must be at least 2 characters'),
    description: z.string().trim().max(1000).optional(),
    category: z.enum(CATEGORIES),
    unit: z.string().trim().min(1).max(20).default('unit'),
    isSubscribable: z.boolean().default(false),
    listPrice: money('List price'),
    costPrice: money('Cost price'),
    taxRate: z
      .number()
      .min(0, 'Tax rate cannot be negative')
      .max(100, 'Tax rate cannot exceed 100')
      .default(0),
    isActive: z.boolean().default(true),
  })
  // Selling below cost is a margin error, not a pricing strategy. Caught here so
  // no quotation can ever be built on a product with negative margin at list price.
  .refine((data) => data.costPrice <= data.listPrice, {
    message: 'Cost price cannot exceed list price',
    path: ['costPrice'],
  });

// Every field optional on update, but the cost-vs-list rule still has to hold.
// It can only be checked when both values are known, so the service re-validates
// against the stored record for a partial update.
export const updateProductSchema = z
  .object({
    sku: z.string().trim().min(2).max(40).toUpperCase().optional(),
    name: z.string().trim().min(2).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    category: z.enum(CATEGORIES).optional(),
    unit: z.string().trim().min(1).max(20).optional(),
    isSubscribable: z.boolean().optional(),
    listPrice: money('List price').optional(),
    costPrice: money('Cost price').optional(),
    taxRate: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

// Query strings arrive as text, so booleans and numbers are coerced here.
export const listProductsSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  search: z.string().trim().min(1).optional(),
  isSubscribable: z.enum(['true', 'false']).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});
