import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Repeat } from 'lucide-react';
import toast from 'react-hot-toast';

import { listMySubscriptions } from '../api/portal';
import EmptyState from '../components/EmptyState';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import StatusBadge from '../components/StatusBadge';
import { NETRIX_TAG, useBrandTag } from '../hooks/useBrandTag';

const CYCLE_LABEL = { MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', YEARLY: 'Yearly' };

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const MySubscriptions = () => {
  useBrandTag(`My Subscriptions · ${NETRIX_TAG.title}`, NETRIX_TAG.icon);

  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    listMySubscriptions()
      .then(setSubscriptions)
      .catch(() => toast.error('Could not load your subscriptions'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          My Subscriptions
        </h1>
        <p className="mt-2 text-slate-600">Your recurring plans, billing schedule and upcoming charges.</p>

        {isLoading ? (
          <p className="mt-10 text-sm text-slate-500">Loading your subscriptions…</p>
        ) : subscriptions.length === 0 ? (
          <div className="mt-10 rounded-lg border border-slate-200">
            <EmptyState
              icon={Repeat}
              title="No subscriptions yet"
              description="Once a recurring order is confirmed, it'll show up here."
            />
          </div>
        ) : (
          <div className="mt-8 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {subscriptions.map((sub) => {
              const pendingInvoice = sub.invoices?.find?.((inv) => inv.status === 'PENDING_APPROVAL');
              return (
                <div key={sub.id} className="flex items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{sub.product.name}</p>
                      <StatusBadge status={sub.status} dot />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {CYCLE_LABEL[sub.cycle]} · Qty {sub.quantity} · Next billing {formatDate(sub.nextBillingDate)}
                    </p>
                    {pendingInvoice && (
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        Renewal of ₹{pendingInvoice.amount.toLocaleString('en-IN')} needs your approval
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-sm font-medium tabular-nums text-slate-900">
                    ₹{sub.upcomingCharge.toLocaleString('en-IN')}
                  </p>
                  <Link to={`/portal/subscriptions/${sub.id}`}>
                    <button
                      type="button"
                      className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Manage
                    </button>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default MySubscriptions;
