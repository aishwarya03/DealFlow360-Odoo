import { z } from 'zod';

const percent = (label) =>
  z
    .number({ message: `${label} must be a number` })
    .min(0, `${label} cannot be negative`)
    .max(100, `${label} cannot exceed 100`);

export const createRuleSchema = z.object({
  customerTierId: z.number().int().positive('customerTierId is required'),
  categoryId: z.number().int().positive('categoryId is required'),
  maxDiscountPercent: percent('Max discount'),
  isActive: z.boolean().default(true),
});

export const updateRuleSchema = z
  .object({
    customerTierId: z.number().int().positive().optional(),
    categoryId: z.number().int().positive().optional(),
    maxDiscountPercent: percent('Max discount').optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listRulesSchema = z.object({
  customerTierId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

// The explicit resolution call: "which rule governs this tier + category?"
export const resolveRuleSchema = z.object({
  customerTierId: z.coerce.number().int().positive('customerTierId is required'),
  categoryId: z.coerce.number().int().positive('categoryId is required'),
});

export const evaluateSchema = z.object({
  customerId: z.number().int().positive('customerId is required'),
  lines: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive('Quantity must be at least 1'),
        discountPercent: percent('Discount').default(0),
        // Optional so a caller can evaluate against a price already agreed on
        // a line, rather than the product's current list price.
        unitPrice: z.number().nonnegative().optional(),
      })
    )
    .min(1, 'At least one line is required'),
});
