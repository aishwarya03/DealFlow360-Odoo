import apiClient from './client';

const PORTAL_TOKEN_KEY = 'df360_portal_token';

export const getPortalToken = () => localStorage.getItem(PORTAL_TOKEN_KEY);
export const setPortalToken = (token) => localStorage.setItem(PORTAL_TOKEN_KEY, token);
export const clearPortalToken = () => localStorage.removeItem(PORTAL_TOKEN_KEY);

/*
 * Signup and first quotation in one call — the server creates the customer,
 * the lead record and a real DRAFT quotation inside one transaction, so this
 * either fully succeeds or leaves nothing behind.
 *
 * Portal tokens are a different audience from staff tokens and are stored
 * under their own key: the two sessions are independent, and a portal token
 * is rejected outright by /api/internal routes.
 */
export const registerAndRequestQuote = async (payload) => {
  const { data } = await apiClient.post('/api/portal/quote-requests', payload);
  if (data.data?.token) setPortalToken(data.data.token);
  return data.data;
};

/*
 * Plain signup, no quotation attached — used when someone is creating an
 * account without cart items (e.g. redirected here from a login attempt for
 * an unrecognized email). registerAndRequestQuote below is for the "sign up
 * and request a quote in one go" path, which requires at least one line.
 */
export const registerCustomer = async (payload) => {
  const { data } = await apiClient.post('/api/portal/auth/register', payload);
  if (data.data?.token) setPortalToken(data.data.token);
  return data.data;
};

export const portalLogin = async (email, password) => {
  const { data } = await apiClient.post('/api/portal/auth/login', { email, password });
  if (data.data?.token) setPortalToken(data.data.token);
  return data.data;
};

/*
 * Confirms a stored portal token still resolves to an active customer.
 * Called before trusting getPortalToken() for anything — a token can outlive
 * the session it belonged to (deactivated account, expired token).
 */
export const getCurrentCustomer = async () => {
  const { data } = await apiClient.get('/api/portal/auth/me', {
    headers: { Authorization: `Bearer ${getPortalToken()}` },
  });
  return data.data.customer;
};

/*
 * Request a quote as an already-signed-in customer — no password, no
 * account fields, just lines + message against the authenticated endpoint.
 */
export const requestQuoteAsCustomer = async ({ lines, message }) => {
  const { data } = await apiClient.post(
    '/api/portal/quotations',
    { lines, message },
    { headers: { Authorization: `Bearer ${getPortalToken()}` } }
  );
  return data.data.quotation;
};

export const listMyQuotations = async () => {
  const { data } = await apiClient.get('/api/portal/quotations', {
    headers: { Authorization: `Bearer ${getPortalToken()}` },
  });
  return data.data.quotations;
};

export const getMyQuotation = async (id) => {
  const { data } = await apiClient.get(`/api/portal/quotations/${id}`, {
    headers: { Authorization: `Bearer ${getPortalToken()}` },
  });
  return data.data.quotation;
};

const portalAuth = () => ({ headers: { Authorization: `Bearer ${getPortalToken()}` } });

export const listMySubscriptions = async () => {
  const { data } = await apiClient.get('/api/portal/subscriptions', portalAuth());
  return data.data.subscriptions;
};

export const getMySubscription = async (id) => {
  const { data } = await apiClient.get(`/api/portal/subscriptions/${id}`, portalAuth());
  return data.data.subscription;
};

export const previewMyQuantityChange = async (id, quantity) => {
  const { data } = await apiClient.post(
    `/api/portal/subscriptions/${id}/quantity-change/preview`,
    { quantity },
    portalAuth()
  );
  return data.data.preview;
};

export const applyMyQuantityChange = async (id, quantity, note) => {
  const { data } = await apiClient.post(
    `/api/portal/subscriptions/${id}/quantity-change`,
    { quantity, note },
    portalAuth()
  );
  return data.data.subscription;
};

export const previewMyPlanChange = async (id, cycle) => {
  const { data } = await apiClient.post(
    `/api/portal/subscriptions/${id}/plan-change/preview`,
    { cycle },
    portalAuth()
  );
  return data.data.preview;
};

export const applyMyPlanChange = async (id, cycle, note) => {
  const { data } = await apiClient.post(`/api/portal/subscriptions/${id}/plan-change`, { cycle, note }, portalAuth());
  return data.data.subscription;
};

export const previewMyCancel = async (id, mode) => {
  const { data } = await apiClient.post(`/api/portal/subscriptions/${id}/cancel/preview`, { mode }, portalAuth());
  return data.data.preview;
};

export const cancelMySubscription = async (id, mode, note) => {
  const { data } = await apiClient.post(`/api/portal/subscriptions/${id}/cancel`, { mode, note }, portalAuth());
  return data.data.subscription;
};

export const approveRenewalInvoice = async (id, invoiceId) => {
  const { data } = await apiClient.post(`/api/portal/subscriptions/${id}/invoices/${invoiceId}/approve`, {}, portalAuth());
  return data.data.subscription;
};

export const rejectRenewalInvoice = async (id, invoiceId, note) => {
  const { data } = await apiClient.post(
    `/api/portal/subscriptions/${id}/invoices/${invoiceId}/reject`,
    { note },
    portalAuth()
  );
  return data.data.subscription;
};
