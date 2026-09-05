import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  parentId: z.number().int().positive().nullable().optional(),
  // Percent. Null means "inherit from the nearest ancestor with one defined"
  // once the discount risk engine reads this — see schema.prisma comment.
  discountCeiling: z.number().min(0).max(100).nullable().optional(),
});

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    parentId: z.number().int().positive().nullable().optional(),
    discountCeiling: z.number().min(0).max(100).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listCategoriesSchema = z.object({
  search: z.string().trim().min(1).optional(),
});
