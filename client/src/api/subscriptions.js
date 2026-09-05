import apiClient from './client';

export const listSubscriptions = async (params = {}) => {
  const res = await apiClient.get('/api/internal/subscriptions', { params });
  return res.data.data.subscriptions;
};

export const getSubscription = async (id) => {
  const res = await apiClient.get(`/api/internal/subscriptions/${id}`);
  return res.data.data.subscription;
};

export const previewQuantityChange = async (id, quantity) => {
  const res = await apiClient.post(`/api/internal/subscriptions/${id}/quantity-change/preview`, { quantity });
  return res.data.data.preview;
};

export const applyQuantityChange = async (id, quantity, note) => {
  const res = await apiClient.post(`/api/internal/subscriptions/${id}/quantity-change`, { quantity, note });
  return res.data.data.subscription;
};

export const previewPlanChange = async (id, cycle) => {
  const res = await apiClient.post(`/api/internal/subscriptions/${id}/plan-change/preview`, { cycle });
  return res.data.data.preview;
};

export const applyPlanChange = async (id, cycle, note) => {
  const res = await apiClient.post(`/api/internal/subscriptions/${id}/plan-change`, { cycle, note });
  return res.data.data.subscription;
};

export const previewCancel = async (id, mode) => {
  const res = await apiClient.post(`/api/internal/subscriptions/${id}/cancel/preview`, { mode });
  return res.data.data.preview;
};

export const cancelSubscription = async (id, mode, note) => {
  const res = await apiClient.post(`/api/internal/subscriptions/${id}/cancel`, { mode, note });
  return res.data.data.subscription;
};
