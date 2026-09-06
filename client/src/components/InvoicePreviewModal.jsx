import { useEffect, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Download, X } from 'lucide-react';

import { formatINR } from '../lib/currency';
import Button from './Button';
import InvoiceDocument from './InvoiceDocument';
import StatusBadge from './StatusBadge';

// Derived, never stored — same "no code column" convention as Quotation's
// own Q-1042 (see quotation.service.js's displayCode). A different prefix
// and base than Q- just so the two document numbers never collide visually.
const invoiceCode = (id) => `INV-${2000 + id}`;

// Only non-recurring lines were ever part of this invoice (see
// quotation.service.js's computeOneTimeInvoiceAmounts) — lines are
// immutable once a quotation leaves DRAFT/UNDER_NEGOTIATION, so recomputing
// this breakdown from the quotation's current lines always matches what was
// actually invoiced. The authoritative totals still come from the Invoice
// row itself, not from this recomputation.
const oneTimeLineRows = (lines = []) =>
  lines
    .filter((line) => !line.isRecurring)
    .map((line) => {
      const gross = line.unitPrice * line.quantity;
      const discountAmount = gross * (line.discountPercent / 100);
      const net = gross - discountAmount;
      const tax = net * (line.taxRateAtEntry / 100);
      return { ...line, gross, discountAmount, net, tax, total: net + tax };
    });

/**
 * A read-mostly preview of the one-time Invoice generated on delivery —
 * opened from the quotation page's Invoice smart button. Not a separate
 * page: nothing about an invoice needs deep-linking or its own route yet.
 */
const InvoicePreviewModal = ({ quotation, onClose, onMarkPaid, canMarkPaid = false, isBusy = false }) => {
  const invoice = quotation.invoice;
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!invoice) return null;

  const lineRows = oneTimeLineRows(quotation.lines);
  const statusForBadge = invoice.isOverdue ? 'OVERDUE' : invoice.status;
  const totalDiscount = lineRows.reduce((sum, line) => sum + line.discountAmount, 0);

  // Generated on demand from the live quotation/invoice record — see
  // InvoiceDocument. A real laid-out PDF (react-pdf's own engine), not a
  // browser print of this scrollable modal, which was clipping content.
  const downloadPdf = async () => {
    setIsDownloading(true);
    try {
      const blob = await pdf(<InvoiceDocument quotation={quotation} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoiceCode(invoice.id)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs animate-fade-in" />

      <div className="relative w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl animate-zoom-in">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="size-4" />
        </button>

        <div className="max-h-[80vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between border-b border-slate-100 pb-4">
            <div>
              <p className="text-base font-semibold text-slate-900">Netrix Systems Pvt Ltd</p>
              <p className="text-xs text-slate-400">Bengaluru, Karnataka</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold tracking-tight text-slate-900">INVOICE</p>
              <p className="text-xs text-slate-400">{invoiceCode(invoice.id)}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xs">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Bill to</p>
              <p className="text-sm font-medium text-slate-900">{quotation.customer.name}</p>
              {quotation.customer.email && <p className="text-xs text-slate-500">{quotation.customer.email}</p>}
              {quotation.customer.phone && <p className="text-xs text-slate-500">{quotation.customer.phone}</p>}
              <p className="text-xs text-slate-400">Ref: {quotation.code} · owned by {quotation.owner.name}</p>

              <p className="mt-3 text-[11px] uppercase tracking-wide text-slate-400">Delivery address</p>
              <p className="text-xs text-slate-600">{quotation.customer.address || 'Not on file'}</p>
            </div>
            <div className="text-right text-sm">
              <p>
                <span className="text-slate-400">Invoice date </span>
                <span className="text-slate-900">{new Date(invoice.createdAt).toLocaleDateString()}</span>
              </p>
              <p>
                <span className="text-slate-400">Due date </span>
                <span className="text-slate-900">{new Date(invoice.dueDate).toLocaleDateString()}</span>
              </p>
              {quotation.deliveredAt && (
                <p>
                  <span className="text-slate-400">Delivered on </span>
                  <span className="text-slate-900">{new Date(quotation.deliveredAt).toLocaleDateString()}</span>
                </p>
              )}
              <p className="mt-1">
                <StatusBadge status={statusForBadge} dot />
              </p>
            </div>
          </div>

          <table className="mt-5 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Unit price</th>
                <th className="py-2 text-right font-medium">Discount</th>
                <th className="py-2 text-right font-medium">GST</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineRows.map((line) => (
                <tr key={line.id} className="border-b border-slate-100">
                  <td className="py-2 text-slate-900">{line.product?.name ?? `#${line.productId}`}</td>
                  <td className="py-2 text-right text-slate-600">{line.quantity}</td>
                  <td className="py-2 text-right text-slate-600">{formatINR(line.unitPrice)}</td>
                  <td className="py-2 text-right text-slate-600">
                    {line.discountPercent > 0 ? (
                      <span>
                        {line.discountPercent}%
                        <span className="ml-1 text-slate-400">(-{formatINR(line.discountAmount)})</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2 text-right text-slate-600">{line.taxRateAtEntry}%</td>
                  <td className="py-2 text-right font-medium text-slate-900">{formatINR(line.total)}</td>
                </tr>
              ))}
              {lineRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-slate-400">
                    No one-time lines on this invoice.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Gross</span>
                <span>{formatINR(invoice.netAmount + totalDiscount)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Discount</span>
                  <span>-{formatINR(totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span>{formatINR(invoice.netAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>GST</span>
                <span>{formatINR(invoice.taxAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900">
                <span>Total due</span>
                <span>{formatINR(invoice.totalAmount)}</span>
              </div>
            </div>
          </div>

          {invoice.status === 'PAID' && invoice.paidAt && (
            <p className="mt-4 text-right text-xs text-green-600">
              Paid on {new Date(invoice.paidAt).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 p-4">
          <Button variant="secondary" size="sm" disabled={isDownloading} onClick={downloadPdf}>
            <Download className="size-4" aria-hidden="true" />
            {isDownloading ? 'Generating…' : 'Download PDF'}
          </Button>
          {invoice.status === 'UNPAID' && canMarkPaid && (
            <Button variant="success" size="sm" disabled={isBusy} onClick={onMarkPaid}>
              Mark Paid
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InvoicePreviewModal;
