import apiClient from './client';

export const listProducts = async (params = {}) => {
  const res = await apiClient.get('/api/internal/products', { params });
  return res.data.data.products;
};
