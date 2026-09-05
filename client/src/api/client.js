import axios from 'axios';

const TOKEN_KEY = 'df360_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  // A portal call sets its own Authorization header (a different token
  // audience) — never overwrite it with the staff token.
  if (config.headers.Authorization) return config;
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/*
 * 401 means the session itself is gone (missing/expired/wrong-audience
 * token) — clear it and force a fresh login. 403 means the session is fine
 * but this role can't do this, which is a per-screen concern, not a global
 * one, so it is deliberately left alone here. See docs/API.html "Status
 * codes" — conflating the two is the most common mistake against this API.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
