import { z } from 'zod';

const positiveInt = (label) =>
  z
    .number({ message: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} cannot be negative`)
    .max(1000000, `${label} is unrealistically large`);

// Sets a stock row to an absolute state — a stocktake result, or the initial
// load of a new product into a warehouse.
export const setStockSchema = z.object({
  warehouseId: z.number().int().positive('warehouseId is required'),
  productId: z.number().int().positive('productId is required'),
  onHandQty: positiveInt('On-hand quantity'),
  reorderPoint: positiveInt('Reorder point').default(0),
  reorderQty: positiveInt('Reorder quantity').default(0),
  reason: z.string().trim().min(3).max(200).optional(),
});

// Applies a signed change — a delivery arriving, damage written off. Separate
// from set because "add 20" and "make it 20" are different operations and
// conflating them is how stock goes wrong under concurrent edits.
export const adjustStockSchema = z.object({
  warehouseId: z.number().int().positive('warehouseId is required'),
  productId: z.number().int().positive('productId is required'),
  delta: z
    .number({ message: 'Delta must be a number' })
    .int('Delta must be a whole number')
    .refine((value) => value !== 0, { message: 'Delta cannot be zero' }),
  // Required, unlike on set: an unexplained correction to a stock balance is
  // exactly what makes inventory untrustworthy.
  reason: z
    .string()
    .trim()
    .min(3, 'Give a reason of at least 3 characters')
    .max(200),
});

// Preview for the add-to-quotation flow: "if I add N of this product, how
// would it split across warehouses right now?"
export const allocationSuggestionSchema = z.object({
  productId: z.coerce.number().int().positive('productId is required'),
  quantity: z.coerce.number().int().positive('quantity must be at least 1'),
});

export const listStockSchema = z.object({
  warehouseId: z.coerce.number().int().positive().optional(),
  productId: z.coerce.number().int().positive().optional(),
  lowStock: z.enum(['true', 'false']).optional(),
  inStockOnly: z.enum(['true', 'false']).optional(),
});
