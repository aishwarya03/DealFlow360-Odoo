import apiClient from './client';

export const listWarehouses = async (params = {}) => {
  const res = await apiClient.get('/api/internal/warehouses', { params });
  return res.data.data.warehouses;
};

export const createWarehouse = async (data) => {
  const res = await apiClient.post('/api/internal/warehouses', data);
  return res.data.data.warehouse;
};

export const updateWarehouse = async (id, data) => {
  const res = await apiClient.patch(`/api/internal/warehouses/${id}`, data);
  return res.data.data.warehouse;
};

export const deactivateWarehouse = async (id) => {
  const res = await apiClient.delete(`/api/internal/warehouses/${id}`);
  return res.data.data.warehouse;
};
