import { z } from 'zod';

export const createTierSchema = z.object({
  code: z.string().trim().min(2).max(20).toUpperCase(),
  name: z.string().trim().min(2).max(60),
  rank: z.number().int().min(1).max(999),
  defaultMaxDiscountPercent: z.number().min(0).max(100),
  // Blended risk score above which Finance must approve as well.
  financeEscalationSeverity: z.number().min(0).max(100).default(5),
  isActive: z.boolean().default(true),
});

export const updateTierSchema = z
  .object({
    code: z.string().trim().min(2).max(20).toUpperCase().optional(),
    name: z.string().trim().min(2).max(60).optional(),
    rank: z.number().int().min(1).max(999).optional(),
    defaultMaxDiscountPercent: z.number().min(0).max(100).optional(),
    financeEscalationSeverity: z.number().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });

export const listTiersSchema = z.object({
  includeInactive: z.enum(['true', 'false']).optional(),
});

// Weights are checked as a set in the service (they must total 100), since a
// partial update can only be validated against the stored values.
export const updateScoringConfigSchema = z
  .object({
    purchaseValueWeight: z.number().min(0).max(100).optional(),
    orderCountWeight: z.number().min(0).max(100).optional(),
    recencyWeight: z.number().min(0).max(100).optional(),
    relationshipWeight: z.number().min(0).max(100).optional(),
    purchaseValueTarget: z.number().positive().optional(),
    orderCountTarget: z.number().int().positive().optional(),
    recencyHorizonDays: z.number().int().positive().optional(),
    relationshipTargetYears: z.number().positive().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  });
