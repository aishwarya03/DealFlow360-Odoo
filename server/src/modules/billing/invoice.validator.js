import { z } from 'zod';

// OVERDUE isn't a stored InvoiceStatus (see schema comment) — the service
// translates it into the real UNPAID + past-due condition.
export const listInvoicesSchema = z.object({
  status: z.enum(['UNPAID', 'PAID', 'OVERDUE']).optional(),
  customerId: z.coerce.number().int().positive().optional(),
});
