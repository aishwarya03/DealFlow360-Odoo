import apiClient from './client';

export const listProducts = async (params = {}) => {
  const res = await apiClient.get('/api/internal/products', { params });
  return res.data.data;
};

export const listPublicProducts = async (params = {}) => {
  const res = await apiClient.get('/api/public/products', { params });
  return res.data.data;
};

export const getPublicProduct = async (id) => {
  const res = await apiClient.get(`/api/public/products/${id}`);
  return res.data.data.product;
};

export const createProduct = async (data) => {
  const res = await apiClient.post('/api/internal/products', data);
  return res.data.data.product;
};

export const updateProduct = async (id, data) => {
  const res = await apiClient.patch(`/api/internal/products/${id}`, data);
  return res.data.data.product;
};

export const deactivateProduct = async (id) => {
  const res = await apiClient.delete(`/api/internal/products/${id}`);
  return res.data.data.product;
};

export const getProductSubscriptionPlans = async (id) => {
  const res = await apiClient.get(`/api/internal/products/${id}/subscription-plans`);
  return res.data.data.plans;
};

export const updateProductSubscriptionPlans = async (id, plans) => {
  const res = await apiClient.put(`/api/internal/products/${id}/subscription-plans`, { plans });
  return res.data.data.plans;
};

export const uploadProductImage = async (id, file) => {
  const body = new FormData();
  body.append('image', file);
  const res = await apiClient.post(`/api/internal/products/${id}/image`, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data.product;
};
