import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import toast from 'react-hot-toast';

import { listMyQuotations } from '../api/portal';
import EmptyState from '../components/EmptyState';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import { NETRIX_TAG, useBrandTag } from '../hooks/useBrandTag';

const displayCode = (id) => `Q-${1000 + id}`;

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

const MyQuotations = () => {
  useBrandTag(`My Quotations · ${NETRIX_TAG.title}`, NETRIX_TAG.icon);

  const [quotations, setQuotations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listMyQuotations()
      .then(setQuotations)
      .catch(() => toast.error('Could not load your quotations'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          My Quotations
        </h1>
        <p className="mt-2 text-slate-600">
          Everything you&apos;ve requested, and where each one stands.
        </p>

        {isLoading ? (
          <p className="mt-10 text-sm text-slate-500">Loading your quotations…</p>
        ) : quotations.length === 0 ? (
          <div className="mt-10 rounded-lg border border-slate-200">
            <EmptyState
              icon={FileText}
              title="No quotations yet"
              description="Once you request a quote, it'll show up here."
              action={
                <Link to="/products">
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Browse Products & Services
                  </button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-8 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {quotations.map((quotation) => (
              <div key={quotation.id} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900">{displayCode(quotation.id)}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLE[quotation.status] ?? 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {STATUS_LABEL[quotation.status] ?? quotation.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {quotation.lines.length} item{quotation.lines.length === 1 ? '' : 's'} ·{' '}
                    {new Date(quotation.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-medium tabular-nums text-slate-900">
                  ₹{quotation.total.toLocaleString('en-IN')}
                </p>
                <Link to={`/portal/quotations/${quotation.id}`}>
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    View
                  </button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default MyQuotations;
