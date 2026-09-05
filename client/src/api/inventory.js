import apiClient from './client';

export const listStock = async (params = {}) => {
  const res = await apiClient.get('/api/internal/inventory', { params });
  return res.data.data.stock;
};

export const listLowStock = async () => {
  const res = await apiClient.get('/api/internal/inventory/low-stock');
  return res.data.data.stock;
};
