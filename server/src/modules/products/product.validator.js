import { z } from 'zod';

const PRODUCT_TYPES = ['GOODS', 'SERVICE', 'COMBO'];

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
    productType: z.enum(PRODUCT_TYPES).default('GOODS'),
    categoryId: z.number().int().positive('categoryId is required'),
    unit: z.string().trim().min(1).max(20).default('unit'),
    imageUrl: z.string().trim().max(500).optional(),
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
    productType: z.enum(PRODUCT_TYPES).optional(),
    categoryId: z.number().int().positive().optional(),
    unit: z.string().trim().min(1).max(20).optional(),
    imageUrl: z.string().trim().max(500).nullable().optional(),
    isSubscribable: z.boolean().optional(),
    listPrice: money('List price').optional(),
    costPrice: money('Cost price').optional(),
    taxRate: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

const CYCLES = ['MONTHLY', 'QUARTERLY', 'YEARLY'];

// One row per cycle the admin wants configured for this product — the
// per-plan amount a recurring QuotationLine is priced from (see
// buildLineData in quotation.service.js). Duplicate cycles in one payload
// are rejected so the upsert loop in product.service.js is never handed
// two conflicting amounts for the same cycle.
export const upsertSubscriptionPlansSchema = z
  .object({
    plans: z
      .array(
        z.object({
          cycle: z.enum(CYCLES),
          amount: money('Plan amount'),
          isActive: z.boolean().default(true),
        })
      )
      .min(1, 'Provide at least one plan'),
  })
  .refine((data) => new Set(data.plans.map((p) => p.cycle)).size === data.plans.length, {
    message: 'Each cycle can only appear once',
    path: ['plans'],
  });

// Query strings arrive as text, so booleans and numbers are coerced here.
export const listProductsSchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  category: z.string().trim().min(1).optional(),
  productType: z.enum(PRODUCT_TYPES).optional(),
  search: z.string().trim().min(1).optional(),
  isSubscribable: z.enum(['true', 'false']).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(12),
});
