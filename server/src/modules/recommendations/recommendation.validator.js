import { z } from 'zod';

const TYPES = ['UPSELL', 'CROSS_SELL'];

export const createRecommendationSchema = z
  .object({
    sourceProductId: z.number().int().positive(),
    targetProductId: z.number().int().positive(),
    type: z.enum(TYPES),
    promoted: z.boolean().default(false),
    minMarginPercent: z.number().min(0).max(100).default(0),
  })
  .refine((data) => data.sourceProductId !== data.targetProductId, {
    message: 'A product cannot be recommended against itself',
    path: ['targetProductId'],
  });

// Which pair this recommends is its identity — re-pairing it is a delete
// and a new row, not an edit. Only the pairing's own metadata is mutable.
export const updateRecommendationSchema = z
  .object({
    promoted: z.boolean().optional(),
    minMarginPercent: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listRecommendationsSchema = z.object({
  sourceProductId: z.coerce.number().int().positive().optional(),
  targetProductId: z.coerce.number().int().positive().optional(),
  type: z.enum(TYPES).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

// Query strings arrive as text — a comma-separated list of product ids
// currently in the order (quotation lines or cart items).
export const suggestSchema = z.object({
  productIds: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').map(Number) : []))
    .refine((ids) => ids.every((id) => Number.isInteger(id) && id > 0), {
      message: 'productIds must be a comma-separated list of positive integers',
    }),
});
