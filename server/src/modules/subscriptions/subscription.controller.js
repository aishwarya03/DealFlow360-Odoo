import { sendSuccess } from '../../utils/apiResponse.js';
import * as subscriptionService from './subscription.service.js';

// ── Internal (staff) ─────────────────────────────────────────────────────

export const list = async (req, res) => {
  const subscriptions = await subscriptionService.listSubscriptions(req.validatedQuery);
  sendSuccess(res, 'Subscriptions', { subscriptions, count: subscriptions.length });
};

export const getOne = async (req, res) => {
  const subscription = await subscriptionService.getSubscriptionById(req.params.id);
  sendSuccess(res, 'Subscription', { subscription });
};

export const previewQuantityChange = async (req, res) => {
  const preview = await subscriptionService.previewSubscriptionQuantityChange(req.params.id, req.body.quantity);
  sendSuccess(res, 'Proration preview', { preview });
};

export const applyQuantityChange = async (req, res) => {
  const subscription = await subscriptionService.applySubscriptionQuantityChange(
    req.params.id,
    req.body.quantity,
    undefined,
    req.body.note
  );
  sendSuccess(res, 'Quantity updated', { subscription });
};

export const previewPlanChange = async (req, res) => {
  const preview = await subscriptionService.previewSubscriptionPlanChange(req.params.id, req.body.cycle);
  sendSuccess(res, 'Proration preview', { preview });
};

export const applyPlanChange = async (req, res) => {
  const subscription = await subscriptionService.applySubscriptionPlanChange(
    req.params.id,
    req.body.cycle,
    undefined,
    req.body.note
  );
  sendSuccess(res, 'Plan updated', { subscription });
};

export const previewCancel = async (req, res) => {
  const preview = await subscriptionService.previewSubscriptionCancellation(req.params.id, req.body.mode);
  sendSuccess(res, 'Cancellation preview', { preview });
};

export const cancel = async (req, res) => {
  const subscription = await subscriptionService.cancelSubscription(
    req.params.id,
    req.body.mode,
    undefined,
    req.body.note
  );
  sendSuccess(res, 'Subscription cancelled', { subscription });
};

export const runBilling = async (req, res) => {
  const result = await subscriptionService.runBillingCycle();
  sendSuccess(res, 'Billing cycle run', result);
};

// ── Portal (customer) ────────────────────────────────────────────────────

export const listMine = async (req, res) => {
  const subscriptions = await subscriptionService.listCustomerSubscriptions(req.user.id);
  sendSuccess(res, 'Your subscriptions', { subscriptions, count: subscriptions.length });
};

export const getMine = async (req, res) => {
  const subscription = await subscriptionService.getSubscriptionById(req.params.id, req.user.id);
  sendSuccess(res, 'Subscription', { subscription });
};

export const previewMyQuantityChange = async (req, res) => {
  const preview = await subscriptionService.previewSubscriptionQuantityChange(
    req.params.id,
    req.body.quantity,
    req.user.id
  );
  sendSuccess(res, 'Proration preview', { preview });
};

export const applyMyQuantityChange = async (req, res) => {
  const subscription = await subscriptionService.applySubscriptionQuantityChange(
    req.params.id,
    req.body.quantity,
    req.user.id,
    req.body.note
  );
  sendSuccess(res, 'Quantity updated', { subscription });
};

export const previewMyPlanChange = async (req, res) => {
  const preview = await subscriptionService.previewSubscriptionPlanChange(req.params.id, req.body.cycle, req.user.id);
  sendSuccess(res, 'Proration preview', { preview });
};

export const applyMyPlanChange = async (req, res) => {
  const subscription = await subscriptionService.applySubscriptionPlanChange(
    req.params.id,
    req.body.cycle,
    req.user.id,
    req.body.note
  );
  sendSuccess(res, 'Plan updated', { subscription });
};

export const previewMyCancel = async (req, res) => {
  const preview = await subscriptionService.previewSubscriptionCancellation(req.params.id, req.body.mode, req.user.id);
  sendSuccess(res, 'Cancellation preview', { preview });
};

export const cancelMine = async (req, res) => {
  const subscription = await subscriptionService.cancelSubscription(
    req.params.id,
    req.body.mode,
    req.user.id,
    req.body.note
  );
  sendSuccess(res, 'Subscription cancelled', { subscription });
};

export const approveInvoice = async (req, res) => {
  const subscription = await subscriptionService.approveRenewalInvoice(req.params.id, req.params.invoiceId, req.user.id);
  sendSuccess(res, 'Renewal approved', { subscription });
};

export const rejectInvoice = async (req, res) => {
  const subscription = await subscriptionService.rejectRenewalInvoice(
    req.params.id,
    req.params.invoiceId,
    req.user.id,
    req.body.note
  );
  sendSuccess(res, 'Renewal declined', { subscription });
};
