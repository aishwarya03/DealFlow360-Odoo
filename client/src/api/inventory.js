import apiClient from './client';

export const listStock = async (params = {}) => {
  const res = await apiClient.get('/api/internal/inventory', { params });
  return res.data.data.stock;
};

export const listLowStock = async () => {
  const res = await apiClient.get('/api/internal/inventory/low-stock');
  return res.data.data.stock;
};

export const updateStock = async (payload) => {
  const res = await apiClient.put('/api/internal/inventory', payload);
  return res.data.data.stock;
};

// Preview for the add-to-quotation flow: how a given quantity of this
// product would split across warehouses right now (greedy, largest-
// available-first — see server inventory.service.js's computeAllocation).
export const suggestAllocation = async (productId, quantity) => {
  const res = await apiClient.get('/api/internal/inventory/allocation-suggestion', {
    params: { productId, quantity },
  });
  return res.data.data.allocations;
};
