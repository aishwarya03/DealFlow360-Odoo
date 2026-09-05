import { z } from 'zod';

const QUOTATION_STATUSES = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'UNDER_NEGOTIATION',
  'CONFIRMED',
  'REJECTED',
  'WITHDRAWN',
];

const RECURRING_CYCLES = ['MONTHLY', 'QUARTERLY', 'YEARLY'];

const percent = (label) =>
  z.number({ message: `${label} must be a number` }).min(0).max(100, `${label} cannot exceed 100`);

const newLineSchema = z
  .object({
    productId: z.number().int().positive('productId is required'),
    quantity: z.number().int().positive('quantity must be at least 1'),
    discountPercent: percent('discountPercent').default(0),
    isRecurring: z.boolean().default(false),
    recurringCycle: z.enum(RECURRING_CYCLES).optional(),
  })
  .refine((data) => !data.isRecurring || data.recurringCycle, {
    message: 'recurringCycle is required when isRecurring is true',
    path: ['recurringCycle'],
  });

// Either a fresh quotation (customerId + lines) or a requote (sourceQuotationId,
// customerId inherited — see docs/SOURCE_OF_TRUTH.md §1.6). lines is optional
// on a requote: omitted, it copies the source's lines; provided, it replaces
// them.
export const createQuotationSchema = z
  .object({
    customerId: z.number().int().positive().optional(),
    sourceQuotationId: z.number().int().positive().optional(),
    sourceQuoteRequestId: z.number().int().positive().optional(),
    customerReference: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(2000).optional(),
    lines: z.array(newLineSchema).optional(),
  })
  .refine((data) => data.customerId || data.sourceQuotationId, {
    message: 'Provide either customerId or sourceQuotationId',
    path: ['customerId'],
  })
  .refine((data) => data.sourceQuotationId || (data.lines && data.lines.length > 0), {
    message: 'lines must have at least one entry when not requoting from a source quotation',
    path: ['lines'],
  });

export const updateLinesSchema = z
  .object({
    add: z.array(newLineSchema).optional(),
    update: z
      .array(
        z.object({
          lineId: z.number().int().positive(),
          quantity: z.number().int().positive().optional(),
          discountPercent: percent('discountPercent').optional(),
          isRecurring: z.boolean().optional(),
          recurringCycle: z.enum(RECURRING_CYCLES).nullable().optional(),
        })
      )
      .optional(),
    remove: z.array(z.number().int().positive()).optional(),
  })
  .refine((data) => (data.add?.length ?? 0) + (data.update?.length ?? 0) + (data.remove?.length ?? 0) > 0, {
    message: 'Provide at least one of add, update, or remove',
  });

export const listQuotationsSchema = z.object({
  status: z.enum(QUOTATION_STATUSES).optional(),
  customerId: z.coerce.number().int().positive().optional(),
  ownerId: z.coerce.number().int().positive().optional(),
});

// Used by both /confirm and /withdraw — recording a customer's decision that a
// rep learned about outside the (not-yet-built) portal, e.g. over phone/email.
export const actionNoteSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
