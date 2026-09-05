import apiClient from './client';

export const pingBackend = async () => {
  const response = await apiClient.get('/api/ping');
  return response.data;
};