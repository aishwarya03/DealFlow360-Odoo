import apiClient from './client';

export const getSuggestions = async (productIds) => {
  if (!productIds || productIds.length === 0) return [];
  const res = await apiClient.get('/api/internal/product-recommendations/suggest', {
    params: { productIds: productIds.join(',') },
  });
  return res.data.data.suggestions;
};

export const getPublicSuggestions = async (productIds) => {
  if (!productIds || productIds.length === 0) return [];
  const res = await apiClient.get('/api/public/product-recommendations/suggest', {
    params: { productIds: productIds.join(',') },
  });
  return res.data.data.suggestions;
};

export const listRecommendations = async (params = {}) => {
  const res = await apiClient.get('/api/internal/product-recommendations', { params });
  return res.data.data.recommendations;
};

export const createRecommendation = async (data) => {
  const res = await apiClient.post('/api/internal/product-recommendations', data);
  return res.data.data.recommendation;
};

export const deactivateRecommendation = async (id) => {
  const res = await apiClient.delete(`/api/internal/product-recommendations/${id}`);
  return res.data.data.recommendation;
};
