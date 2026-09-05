import apiClient from './client';

export const listCustomers = async (params = {}) => {
  const res = await apiClient.get('/api/internal/customers', { params });
  return res.data.data.customers;
};
