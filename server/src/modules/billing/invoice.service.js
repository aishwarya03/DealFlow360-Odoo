import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { displayCode, toPublicInvoice } from '../quotations/quotation.service.js';
import { writeAudit } from '../quotations/auditLog.service.js';

// A "list" view status can be OVERDUE even though that's never a stored
// InvoiceStatus (see the schema comment) — translated here into the actual
// stored condition (UNPAID + past due) so filtering behaves the way the
// derived isOverdue field on a single invoice already implies.
const whereForStatusFilter = (status) => {
  if (!status) return {};
  if (status === 'OVERDUE') return { status: 'UNPAID', dueDate: { lt: new Date() } };
  if (status === 'UNPAID') return { status: 'UNPAID', dueDate: { gte: new Date() } };
  return { status };
};

const withQuotationSummary = {
  quotation: {
    select: {
      id: true,
      customer: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
  },
};

const toPublicInvoiceListItem = (invoice) => ({
  ...toPublicInvoice(invoice),
  quotation: {
    id: invoice.quotation.id,
    code: displayCode(invoice.quotation.id),
    customer: invoice.quotation.customer,
    owner: invoice.quotation.owner,
  },
});

export const listInvoices = async (filters = {}) => {
  const where = whereForStatusFilter(filters.status);
  if (filters.customerId) where.quotation = { customerId: filters.customerId };

  const invoices = await prisma.invoice.findMany({
    where,
    include: withQuotationSummary,
    orderBy: { dueDate: 'asc' },
  });

  return invoices.map(toPublicInvoiceListItem);
};

export const getInvoiceById = async (id) => {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: withQuotationSummary });
  if (!invoice) throw ApiError.notFound(`No invoice with id ${id}`);

  return toPublicInvoiceListItem(invoice);
};

// The only write this module has — "Record payments" (access matrix §6,
// Finance + Admin only, enforced in invoice.routes.js). Mock: no payment
// gateway, same as the recurring side's approveRenewalInvoice.
export const markInvoicePaid = async (id, actingUser) => {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw ApiError.notFound(`No invoice with id ${id}`);
  if (invoice.status === 'PAID') throw ApiError.badRequest('This invoice is already paid');

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id }, data: { status: 'PAID', paidAt: now } });
    await writeAudit(tx, {
      quotationId: invoice.quotationId,
      userId: actingUser.id,
      action: 'INVOICE_PAID',
      note: `₹${invoice.totalAmount} recorded as paid`,
    });
  });

  return getInvoiceById(id);
};
