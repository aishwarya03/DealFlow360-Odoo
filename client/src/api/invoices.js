import apiClient from './client';

export const listInvoices = async (params = {}) => {
  const res = await apiClient.get('/api/internal/invoices', { params });
  return res.data.data.invoices;
};

export const getInvoice = async (id) => {
  const res = await apiClient.get(`/api/internal/invoices/${id}`);
  return res.data.data.invoice;
};

export const payInvoice = async (id) => {
  const res = await apiClient.post(`/api/internal/invoices/${id}/pay`);
  return res.data.data.invoice;
};
