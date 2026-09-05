import apiClient from './client';

export const listWarehouses = async (params = {}) => {
  const res = await apiClient.get('/api/internal/warehouses', { params });
  return res.data.data.warehouses;
};
