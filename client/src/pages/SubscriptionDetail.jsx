import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

import {
  getMySubscription,
  previewMyQuantityChange,
  applyMyQuantityChange,
  previewMyPlanChange,
  applyMyPlanChange,
  previewMyCancel,
  cancelMySubscription,
  approveRenewalInvoice,
  rejectRenewalInvoice,
} from '../api/portal';
import Button from '../components/Button';
import SiteFooter from '../components/SiteFooter';
import SiteHeader from '../components/SiteHeader';
import StatusBadge from '../components/StatusBadge';
import { NETRIX_TAG, useBrandTag } from '../hooks/useBrandTag';

const CYCLE_LABEL = { MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', YEARLY: 'Yearly' };

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const Field = ({ label, children }) => (
  <div>
    <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">{label}</p>
    <div className="mt-1 text-sm text-slate-900">{children}</div>
  </div>
);

const ProrationPreview = ({ preview }) => {
  if (!preview) return null;
  const amount = preview.prorationAmount ?? preview.refundAmount ?? 0;
  const isCredit = amount < 0 || (preview.refundAmount ?? 0) > 0;
  const isNone = amount === 0;

  return (
    <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Unused days remaining</span>
        <span className="font-medium tabular-nums text-slate-900">{preview.unusedDays}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-slate-500">
          {preview.refundAmount !== undefined ? 'Refund / credit' : isNone ? 'Adjustment' : isCredit ? 'Account credit' : 'Additional amount due'}
        </span>
        <span className="font-semibold tabular-nums text-slate-900">
          {isNone ? 'No financial adjustment' : `₹${Math.abs(amount).toLocaleString('en-IN')}`}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-400">Effective {formatDate(preview.effectiveDate)}</p>
    </div>
  );
};

const SubscriptionDetail = () => {
  const { id } = useParams();
  useBrandTag(`Subscription · ${NETRIX_TAG.title}`, NETRIX_TAG.icon);

  const [subscription, setSubscription] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const [newQuantity, setNewQuantity] = useState('');
  const [quantityPreview, setQuantityPreview] = useState(null);
  const [newCycle, setNewCycle] = useState('');
  const [planPreview, setPlanPreview] = useState(null);
  const [cancelMode, setCancelMode] = useState('immediate');
  const [cancelPreview, setCancelPreview] = useState(null);

  const load = () => {
    getMySubscription(id)
      .then((data) => {
        setSubscription(data);
        setNewQuantity(String(data.quantity));
      })
      .catch(() => toast.error('Could not load this subscription'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    setIsLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (isLoading) return <p className="mt-10 text-center text-sm text-slate-500">Loading…</p>;
  if (!subscription) {
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
          <p className="text-sm text-slate-500">Subscription not found.</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const isCancelled = subscription.status === 'CANCELLED';
  const pendingInvoice = subscription.invoices?.find((inv) => inv.status === 'PENDING_APPROVAL');

  const approve = async () => {
    setIsBusy(true);
    try {
      setSubscription(await approveRenewalInvoice(id, pendingInvoice.id));
      toast.success('Renewal approved — subscription confirmed for the next period');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not approve the renewal');
    } finally {
      setIsBusy(false);
    }
  };

  const decline = async () => {
    if (!window.confirm('Decline this renewal? The subscription will not continue.')) return;
    setIsBusy(true);
    try {
      setSubscription(await rejectRenewalInvoice(id, pendingInvoice.id));
      toast.success('Renewal declined');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not decline the renewal');
    } finally {
      setIsBusy(false);
    }
  };

  const runQuantityPreview = async () => {
    const qty = Number(newQuantity);
    if (!qty || qty === subscription.quantity) return setQuantityPreview(null);
    try {
      setQuantityPreview(await previewMyQuantityChange(id, qty));
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not preview this change');
    }
  };

  const confirmQuantityChange = async () => {
    setIsBusy(true);
    try {
      setSubscription(await applyMyQuantityChange(id, Number(newQuantity)));
      setQuantityPreview(null);
      toast.success('Quantity updated');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not update quantity');
    } finally {
      setIsBusy(false);
    }
  };

  const runPlanPreview = async (cycle) => {
    setNewCycle(cycle);
    if (!cycle || cycle === subscription.cycle) return setPlanPreview(null);
    try {
      setPlanPreview(await previewMyPlanChange(id, cycle));
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not preview this change');
    }
  };

  const confirmPlanChange = async () => {
    setIsBusy(true);
    try {
      setSubscription(await applyMyPlanChange(id, newCycle));
      setPlanPreview(null);
      setNewCycle('');
      toast.success('Billing frequency updated');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not update the plan');
    } finally {
      setIsBusy(false);
    }
  };

  const runCancelPreview = async (mode) => {
    setCancelMode(mode);
    try {
      setCancelPreview(await previewMyCancel(id, mode));
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not preview cancellation');
    }
  };

  const confirmCancel = async () => {
    if (!window.confirm('Cancel this subscription?')) return;
    setIsBusy(true);
    try {
      setSubscription(await cancelMySubscription(id, cancelMode));
      setCancelPreview(null);
      toast.success('Subscription cancelled');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not cancel this subscription');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <Link
          to="/portal/subscriptions"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          My Subscriptions
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {subscription.product.name}
          </h1>
          <StatusBadge status={subscription.status} dot />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {CYCLE_LABEL[subscription.cycle]} · Qty {subscription.quantity}
        </p>

        {pendingInvoice && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-800">Renewal awaiting your approval</p>
            <p className="mt-1 text-sm text-amber-700">
              {formatDate(pendingInvoice.periodStart)} – {formatDate(pendingInvoice.periodEnd)} · ₹
              {pendingInvoice.amount.toLocaleString('en-IN')}
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="success" disabled={isBusy} onClick={approve}>
                Approve & Pay
              </Button>
              <Button size="sm" variant="danger" disabled={isBusy} onClick={decline}>
                Decline
              </Button>
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-6 rounded-lg border border-slate-200 p-6 sm:grid-cols-4">
          <Field label="Current period">
            {formatDate(subscription.currentPeriodStart)} – {formatDate(subscription.currentPeriodEnd)}
          </Field>
          <Field label="Next billing">{formatDate(subscription.nextBillingDate)}</Field>
          <Field label="Upcoming charge">₹{subscription.upcomingCharge.toLocaleString('en-IN')}</Field>
          <Field label="Following billing">{formatDate(subscription.followingBillingDate)}</Field>
        </div>

        {subscription.cancelAtPeriodEnd && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Cancellation scheduled — this ends on {formatDate(subscription.currentPeriodEnd)} and will not renew.
          </p>
        )}

        {!isCancelled && (
          <>
            <h2 className="mt-10 text-sm font-semibold text-slate-900">Change quantity</h2>
            <p className="mt-1 text-xs text-slate-500">
              A mid-cycle change is prorated against the days left in the current period.
            </p>
            <div className="mt-3 flex items-end gap-3">
              <div className="w-28">
                <label className="mb-1.5 block text-xs font-medium text-slate-600">New quantity</label>
                <input
                  type="number"
                  min="1"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                />
              </div>
              <Button size="sm" variant="secondary" onClick={runQuantityPreview}>
                Preview
              </Button>
              {quantityPreview && (
                <Button size="sm" disabled={isBusy} onClick={confirmQuantityChange}>
                  Confirm {subscription.quantity} → {newQuantity}
                </Button>
              )}
            </div>
            <ProrationPreview preview={quantityPreview} />

            <h2 className="mt-10 text-sm font-semibold text-slate-900">Change billing frequency</h2>
            <div className="mt-3 flex items-end gap-3">
              <div className="w-40">
                <label className="mb-1.5 block text-xs font-medium text-slate-600">New frequency</label>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={newCycle}
                  onChange={(e) => runPlanPreview(e.target.value)}
                >
                  <option value="">Select…</option>
                  {Object.entries(CYCLE_LABEL).map(([value, label]) => (
                    <option key={value} value={value} disabled={value === subscription.cycle}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {planPreview && (
                <Button size="sm" disabled={isBusy} onClick={confirmPlanChange}>
                  Confirm change
                </Button>
              )}
            </div>
            <ProrationPreview preview={planPreview} />

            <h2 className="mt-10 text-sm font-semibold text-slate-900">Cancel subscription</h2>
            <p className="mt-1 text-xs text-slate-500">
              Cancel immediately for a credit on unused days, or let it run to the end of what you've already paid for.
            </p>
            <div className="mt-3 flex items-end gap-3">
              <div className="w-56">
                <label className="mb-1.5 block text-xs font-medium text-slate-600">When</label>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  value={cancelMode}
                  onChange={(e) => runCancelPreview(e.target.value)}
                >
                  <option value="immediate">Immediately</option>
                  <option value="period_end">At the end of the current period</option>
                </select>
              </div>
              <Button size="sm" variant="secondary" onClick={() => runCancelPreview(cancelMode)}>
                Preview
              </Button>
              {cancelPreview && (
                <Button size="sm" variant="danger" disabled={isBusy} onClick={confirmCancel}>
                  Cancel subscription
                </Button>
              )}
            </div>
            <ProrationPreview preview={cancelPreview} />
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default SubscriptionDetail;
