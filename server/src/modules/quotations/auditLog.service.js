// Takes a transaction client, not the global prisma client, on purpose: an
// audit entry must never exist without the state change it describes (or vice
// versa), so every call site writes it inside the same $transaction as the
// change itself. See docs/SOURCE_OF_TRUTH.md §2.10.
export const writeAudit = (tx, { quotationId, userId = null, action, note = null }) =>
  tx.auditLog.create({ data: { quotationId, userId, action, note } });
