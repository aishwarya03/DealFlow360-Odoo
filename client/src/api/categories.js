import apiClient from './client';

export const listCategories = async () => {
  const res = await apiClient.get('/api/internal/categories');
  return res.data.data.categories;
};