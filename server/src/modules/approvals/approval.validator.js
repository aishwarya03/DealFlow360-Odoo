import { z } from 'zod';

// A reason is required for anything other than a plain approve — "logged with
// user, timestamp, and reason" (brief A3) means a reject or a return without
// a note is exactly what must not happen.
export const actOnStepSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT', 'RETURN']),
    note: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.action === 'APPROVE' || (data.note && data.note.length > 0), {
    message: 'A note explaining the reason is required to reject or return a quotation',
    path: ['note'],
  });

export const listApprovalsSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'RETURNED']).optional(),
});
