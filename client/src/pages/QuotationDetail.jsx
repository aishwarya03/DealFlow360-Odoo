import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

import { getMyQuotation } from '../api/portal';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import { NETRIX_TAG, useBrandTag } from '../hooks/useBrandTag';

const STATUS_STYLE = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-green-50 text-green-700',
  UNDER_NEGOTIATION: 'bg-blue-50 text-blue-700',
  CONFIRMED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-700',
  WITHDRAWN: 'bg-slate-100 text-slate-500',
};

const STATUS_LABEL = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  UNDER_NEGOTIATION: 'Under negotiation',
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const Field = ({ label, children }) => (
  <div>
    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
    <div className="mt-1 text-sm text-slate-900">{children}</div>
  </div>
);

const QuotationDetail = () => {
  const { id } = useParams();
  useBrandTag(`Quotation · ${NETRIX_TAG.title}`, NETRIX_TAG.icon);

  const [quotation, setQuotation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    getMyQuotation(id)
      .then(setQuotation)
      .catch(() => toast.error('Could not load this quotation'))
      .finally(() => setIsLoading(false));
  }, [id]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <Link
          to="/portal/quotations"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          My Quotations
        </Link>

        {isLoading ? (
          <p className="mt-10 text-sm text-slate-500">Loading quotation…</p>
        ) : !quotation ? (
          <p className="mt-10 text-sm text-slate-500">Quotation not found.</p>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {quotation.code}
              </h1>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  STATUS_STYLE[quotation.status] ?? 'bg-slate-100 text-slate-600'
                }`}
              >
                {STATUS_LABEL[quotation.status] ?? quotation.status}
              </span>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-6 rounded-lg border border-slate-200 p-6 sm:grid-cols-2">
              <Field label="Date">{formatDate(quotation.createdAt)}</Field>
              <Field label="Reference">{quotation.customerReference || '—'}</Field>
              <Field label="Notes">
                <span className="whitespace-pre-wrap">{quotation.notes || '—'}</span>
              </Field>
              <Field label="Total">₹{quotation.total.toLocaleString('en-IN')}</Field>
            </div>

            <h2 className="mt-10 text-sm font-semibold text-slate-900">Order lines</h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Product</th>
                    <th className="px-4 py-2.5">SKU</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5 text-right">Unit price</th>
                    <th className="px-4 py-2.5 text-right">Discount</th>
                    <th className="px-4 py-2.5 text-right">Line total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {quotation.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3 text-slate-900">{line.product.name}</td>
                      <td className="px-4 py-3 text-slate-500">{line.product.sku}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{line.quantity}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        ₹{line.unitPrice.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {line.discountPercent ? `${line.discountPercent}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-900">
                        ₹{line.lineTotal.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default QuotationDetail;
