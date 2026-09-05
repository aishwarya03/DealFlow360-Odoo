import apiClient from './client';

export const listCustomers = async (params = {}) => {
  const res = await apiClient.get('/api/internal/customers', { params });
  return res.data.data.customers;
};

export const createCustomer = async (data) => {
  const res = await apiClient.post('/api/internal/customers', data);
  return res.data.data.customer;
};

export const updateCustomer = async (id, data) => {
  const res = await apiClient.patch(`/api/internal/customers/${id}`, data);
  return res.data.data.customer;
};

export const deactivateCustomer = async (id) => {
  const res = await apiClient.delete(`/api/internal/customers/${id}`);
  return res.data.data.customer;
};
