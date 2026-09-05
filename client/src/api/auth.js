import apiClient, { clearToken, setToken } from './client';

/*
 * Every function here unwraps the { success, message, data } envelope
 * (docs/API.html "Response envelope") so screens work with plain payloads.
 */

export const login = async (email, password) => {
  const res = await apiClient.post('/api/internal/auth/login', { email, password });
  const { user, token } = res.data.data;
  setToken(token);
  return user;
};

export const fetchCurrentUser = async () => {
  const res = await apiClient.get('/api/internal/auth/me');
  return res.data.data.user;
};

export const logout = () => {
  clearToken();
};
