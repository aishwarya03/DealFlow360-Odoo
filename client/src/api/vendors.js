import apiClient from './client';

export const listVendors = async (params = {}) => {
  const res = await apiClient.get('/api/internal/vendors', { params });
  return res.data.data.vendors;
};

export const createVendor = async (data) => {
  const res = await apiClient.post('/api/internal/vendors', data);
  return res.data.data.vendor;
};

export const updateVendor = async (id, data) => {
  const res = await apiClient.patch(`/api/internal/vendors/${id}`, data);
  return res.data.data.vendor;
};

export const deactivateVendor = async (id) => {
  const res = await apiClient.delete(`/api/internal/vendors/${id}`);
  return res.data.data.vendor;
};
