import apiClient from './client';

export const listQuotations = async (params = {}) => {
  const res = await apiClient.get('/api/internal/quotations', { params });
  return res.data.data.quotations;
};

export const getQuotation = async (id) => {
  const res = await apiClient.get(`/api/internal/quotations/${id}`);
  return res.data.data.quotation;
};

export const createQuotation = async (data) => {
  const res = await apiClient.post('/api/internal/quotations', data);
  return res.data.data.quotation;
};

export const updateQuotationLines = async (id, changes) => {
  const res = await apiClient.patch(`/api/internal/quotations/${id}/lines`, changes);
  return res.data.data.quotation;
};

export const submitQuotation = async (id) => {
  const res = await apiClient.post(`/api/internal/quotations/${id}/submit`);
  return res.data.data.quotation;
};

export const confirmQuotation = async (id, note) => {
  const res = await apiClient.post(`/api/internal/quotations/${id}/confirm`, { note });
  return res.data.data.quotation;
};

export const withdrawQuotation = async (id, note) => {
  const res = await apiClient.post(`/api/internal/quotations/${id}/withdraw`, { note });
  return res.data.data.quotation;
};
