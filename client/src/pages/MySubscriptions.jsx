import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, RefreshCw, Repeat } from 'lucide-react';
import toast from 'react-hot-toast';

import { listMySubscriptions } from '../api/portal';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import { SkeletonText } from '../components/Skeleton';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import StatusBadge from '../components/StatusBadge';
import { NETRIX_TAG, useBrandTag } from '../hooks/useBrandTag';

const PAGE_SIZE = 12;

const CYCLE_LABEL = { MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', YEARLY: 'Yearly' };

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const MySubscriptions = () => {
  useBrandTag(`My Subscriptions · ${NETRIX_TAG.title}`, NETRIX_TAG.icon);

  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [page, setPage] = useState(1);

  const load = () => {
    setIsLoading(true);
    setHasError(false);
    listMySubscriptions()
      .then(setSubscriptions)
      .catch(() => {
        setHasError(true);
        toast.error('Could not load your subscriptions');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const totalPages = Math.max(1, Math.ceil(subscriptions.length / PAGE_SIZE));
  const pageSubscriptions = subscriptions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          My Subscriptions
        </h1>
        <p className="mt-2 text-base leading-relaxed text-slate-600">
          Your recurring plans, billing schedule and upcoming charges.
        </p>

        {isLoading ? (
          <div className="mt-8 space-y-3 rounded-lg border border-slate-200 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonText key={i} lines={2} />
            ))}
          </div>
        ) : hasError ? (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-6 py-14 text-center">
            <AlertCircle className="size-8 text-red-500" aria-hidden="true" />
            <p className="text-base font-semibold text-red-700">Couldn&apos;t load your subscriptions</p>
            <p className="max-w-sm text-sm leading-relaxed text-red-600">
              Something went wrong on our end. Please try again in a moment.
            </p>
            <Button variant="secondary" size="sm" onClick={load}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Try again
            </Button>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="mt-10 rounded-lg border border-slate-200">
            <EmptyState
              icon={Repeat}
              title="No subscriptions yet"
              description="Once a recurring order is confirmed, it'll show up here."
            />
          </div>
        ) : (
          <div className="mt-8 animate-fade-in divide-y divide-slate-100 rounded-lg border border-slate-200">
            {pageSubscriptions.map((sub) => {
              const pendingInvoice = sub.invoices?.find?.((inv) => inv.status === 'PENDING_APPROVAL');
              return (
                <div key={sub.id} className="flex items-center gap-4 p-5 transition-colors hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <p className="text-base font-medium text-slate-900">{sub.product.name}</p>
                      <StatusBadge status={sub.status} dot />
                    </div>
                    <p className="mt-1.5 text-sm text-slate-500">
                      {CYCLE_LABEL[sub.cycle]} · Qty {sub.quantity} · Next billing {formatDate(sub.nextBillingDate)}
                    </p>
                    {pendingInvoice && (
                      <p className="mt-1.5 text-sm font-medium text-amber-700">
                        Renewal of ₹{pendingInvoice.amount.toLocaleString('en-IN')} needs your approval
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-base font-medium tabular-nums text-slate-900">
                    ₹{sub.upcomingCharge.toLocaleString('en-IN')}
                  </p>
                  <Link to={`/portal/subscriptions/${sub.id}`} className="shrink-0">
                    <Button variant="secondary" size="sm">Manage</Button>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && !hasError && subscriptions.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4 rounded-lg border border-slate-200" />
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default MySubscriptions;
