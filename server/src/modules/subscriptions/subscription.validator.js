import { z } from 'zod';

const CYCLES = ['MONTHLY', 'QUARTERLY', 'YEARLY'];

export const quantityChangeSchema = z.object({
  quantity: z.number().int().positive('Quantity must be at least 1'),
  note: z.string().trim().max(500).optional(),
});

export const planChangeSchema = z.object({
  cycle: z.enum(CYCLES),
  note: z.string().trim().max(500).optional(),
});

export const cancelSchema = z.object({
  mode: z.enum(['immediate', 'period_end']).default('immediate'),
  note: z.string().trim().max(500).optional(),
});

export const rejectInvoiceSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const listSubscriptionsSchema = z.object({
  customerId: z.coerce.number().int().positive().optional(),
  status: z.enum(['ACTIVE', 'PENDING_RENEWAL_APPROVAL', 'PAST_DUE', 'CANCELLED']).optional(),
});
