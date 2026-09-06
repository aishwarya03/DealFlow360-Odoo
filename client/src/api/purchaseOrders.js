import apiClient from './client';

export const listPurchaseOrders = async (params = {}) => {
  const res = await apiClient.get('/api/internal/purchase-orders', { params });
  return res.data.data.purchaseOrders;
};

export const createPurchaseOrder = async (data) => {
  const res = await apiClient.post('/api/internal/purchase-orders', data);
  return res.data.data.purchaseOrder;
};

export const markPurchaseOrderOrdered = async (id) => {
  const res = await apiClient.post(`/api/internal/purchase-orders/${id}/order`);
  return res.data.data.purchaseOrder;
};

export const completePurchaseOrder = async (id) => {
  const res = await apiClient.post(`/api/internal/purchase-orders/${id}/complete`);
  return res.data.data.purchaseOrder;
};

export const cancelPurchaseOrder = async (id) => {
  const res = await apiClient.post(`/api/internal/purchase-orders/${id}/cancel`);
  return res.data.data.purchaseOrder;
};
