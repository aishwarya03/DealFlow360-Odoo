import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

import Button from '../../components/Button';
import CustomSelect from '../../components/CustomSelect';
import DetailSection from '../../components/DetailSection';
import Logo from '../../components/Logo';
import PageHeader from '../../components/PageHeader';
import StatusBadge from '../../components/StatusBadge';
import {
  getSubscription,
  previewQuantityChange,
  applyQuantityChange,
  previewPlanChange,
  applyPlanChange,
  previewCancel,
  cancelSubscription,
} from '../../api/subscriptions';
import { formatINR } from '../../lib/currency';

const CYCLE_LABEL = { MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', YEARLY: 'Yearly' };

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const Field = ({ label, children }) => (
  <div>
    <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">{label}</p>
    <div className="mt-1 text-sm text-slate-900">{children}</div>
  </div>
);

const ProrationSummary = ({ preview }) => {
  if (!preview) return null;
  const amount = preview.prorationAmount ?? preview.refundAmount ?? 0;
  const isCredit = amount < 0 || preview.adjustmentType === 'ACCOUNT_CREDIT' || (preview.refundAmount ?? 0) > 0;
  const isNone = amount === 0;

  return (
    <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Unused days remaining</span>
        <span className="font-medium tabular-nums text-slate-900">{preview.unusedDays}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-slate-500">
          {preview.refundAmount !== undefined ? 'Refund / credit' : isCredit ? 'Account credit' : isNone ? 'Adjustment' : 'Additional charge due'}
        </span>
        <span className={`font-semibold tabular-nums ${isNone ? 'text-slate-900' : isCredit ? 'text-green-700' : 'text-slate-900'}`}>
          {isNone ? 'No financial adjustment' : formatINR(Math.abs(amount))}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Effective {formatDate(preview.effectiveDate)}
      </p>
    </div>
  );
};

const SubscriptionDetailPage = () => {
  const { id } = useParams();
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
    getSubscription(id)
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

  if (isLoading) return <Logo className="mx-auto mt-20 animate-pulse" />;
  if (!subscription) {
    return (
      <div>
        <PageHeader title="Subscription not found" />
        <Link to="/workspace/subscriptions" className="text-sm text-brand-600 hover:underline">
          Back to subscriptions
        </Link>
      </div>
    );
  }

  const isCancelled = subscription.status === 'CANCELLED';

  const runQuantityPreview = async () => {
    const qty = Number(newQuantity);
    if (!qty || qty === subscription.quantity) return setQuantityPreview(null);
    try {
      setQuantityPreview(await previewQuantityChange(id, qty));
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not preview this change');
    }
  };

  const confirmQuantityChange = async () => {
    setIsBusy(true);
    try {
      const updated = await applyQuantityChange(id, Number(newQuantity));
      setSubscription(updated);
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
      setPlanPreview(await previewPlanChange(id, cycle));
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not preview this change');
    }
  };

  const confirmPlanChange = async () => {
    setIsBusy(true);
    try {
      const updated = await applyPlanChange(id, newCycle);
      setSubscription(updated);
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
      setCancelPreview(await previewCancel(id, mode));
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not preview cancellation');
    }
  };

  const confirmCancel = async () => {
    if (!window.confirm('Cancel this subscription? This cannot be undone.')) return;
    setIsBusy(true);
    try {
      const updated = await cancelSubscription(id, cancelMode);
      setSubscription(updated);
      setCancelPreview(null);
      toast.success('Subscription cancelled');
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Could not cancel this subscription');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div>
      <Link
        to="/workspace/subscriptions"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to subscriptions
      </Link>

      <PageHeader
        title={subscription.product.name}
        subtitle={`${subscription.customer.name} · ${CYCLE_LABEL[subscription.cycle]} · Qty ${subscription.quantity}`}
        actions={<StatusBadge status={subscription.status} dot />}
      />

      <div className="space-y-4">
        <DetailSection title="Billing schedule" description="Where this subscription is in its current cycle, and what happens next.">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Field label="Current period">
              {formatDate(subscription.currentPeriodStart)} – {formatDate(subscription.currentPeriodEnd)}
            </Field>
            <Field label="Next billing">{formatDate(subscription.nextBillingDate)}</Field>
            <Field label="Upcoming charge">{formatINR(subscription.upcomingCharge)}</Field>
            <Field label="Following billing">{formatDate(subscription.followingBillingDate)}</Field>
          </div>
          {subscription.cancelAtPeriodEnd && (
            <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Cancellation scheduled — this subscription ends on {formatDate(subscription.currentPeriodEnd)} and will
              not renew.
            </p>
          )}
        </DetailSection>

        {subscription.invoices?.some((inv) => inv.status === 'PENDING_APPROVAL') && (
          <DetailSection title="Renewal pending" description="Waiting on the customer to approve or decline in the portal.">
            {subscription.invoices
              .filter((inv) => inv.status === 'PENDING_APPROVAL')
              .map((inv) => (
                <div key={inv.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                  </span>
                  <span className="font-semibold text-slate-900">{formatINR(inv.amount)}</span>
                </div>
              ))}
          </DetailSection>
        )}

        {!isCancelled && (
          <DetailSection title="Change quantity" description="Mid-cycle changes are prorated against the days remaining in the current period.">
            <div className="flex items-end gap-3">
              <div className="w-32">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">New quantity</label>
                <input
                  type="number"
                  min="1"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                />
              </div>
              <Button size="sm" variant="secondary" onClick={runQuantityPreview}>
                Preview proration
              </Button>
              {quantityPreview && (
                <Button size="sm" disabled={isBusy} onClick={confirmQuantityChange}>
                  Confirm {subscription.quantity} → {newQuantity}
                </Button>
              )}
            </div>
            <ProrationSummary preview={quantityPreview} />
          </DetailSection>
        )}

        {!isCancelled && (
          <DetailSection title="Change billing frequency" description="Switches the plan this product bills against — proration covers the rest of the current period.">
            <div className="flex items-end gap-3">
              <div className="w-52">
                <CustomSelect
                  label="New frequency"
                  value={newCycle}
                  onChange={(val) => runPlanPreview(val)}
                  placeholder="Select cycle…"
                  options={Object.entries(CYCLE_LABEL).map(([value, label]) => ({
                    value,
                    label,
                    disabled: value === subscription.cycle,
                  }))}
                />
              </div>
              {planPreview && (
                <Button size="sm" disabled={isBusy} onClick={confirmPlanChange}>
                  Confirm {CYCLE_LABEL[subscription.cycle]} → {CYCLE_LABEL[newCycle]}
                </Button>
              )}
            </div>
            <ProrationSummary preview={planPreview} />
          </DetailSection>
        )}

        {!isCancelled && (
          <DetailSection title="Cancel subscription" description="Ends this recurring line — immediately with a credit for unused days, or at the end of the current period with no refund.">
            <div className="flex items-end gap-3">
              <div className="w-64">
                <CustomSelect
                  label="When to cancel"
                  value={cancelMode}
                  onChange={(val) => runCancelPreview(val)}
                  options={[
                    { value: 'immediate', label: 'Immediately (with refund credit)' },
                    { value: 'period_end', label: 'At the end of current period' },
                  ]}
                />
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
            <ProrationSummary preview={cancelPreview} />
            {cancelPreview && cancelPreview.refundAmount === 0 && (
              <p className="mt-2 text-xs text-slate-500">No refund or credit applies to this cancellation.</p>
            )}
          </DetailSection>
        )}

        <DetailSection title="History" description="Every quantity change, plan change and cancellation, with the proration that justified it.">
          {subscription.changes?.length > 0 ? (
            <ol className="space-y-3">
              {subscription.changes.map((change) => (
                <li key={change.id} className="text-sm">
                  <p className="font-medium text-slate-900">{change.type.replaceAll('_', ' ')}</p>
                  <p className="text-slate-500">
                    {change.type === 'QUANTITY_CHANGE' && `Qty ${change.oldQuantity} → ${change.newQuantity}`}
                    {change.type === 'PLAN_CHANGE' && `${change.oldCycle} → ${change.newCycle}`}
                    {change.type === 'CANCELLATION' && 'Subscription cancelled'}
                    {change.prorationAmount != null && ` · ${formatINR(Math.abs(change.prorationAmount))} ${change.prorationAmount >= 0 ? 'charge' : 'credit'}`}
                    {change.refundAmount != null && change.refundAmount > 0 && ` · ${formatINR(change.refundAmount)} refund`}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(change.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">No changes yet.</p>
          )}
        </DetailSection>
      </div>
    </div>
  );
};

export default SubscriptionDetailPage;
