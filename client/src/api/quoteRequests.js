import apiClient from './client';

// POST /api/public/quote-requests — not built server-side yet, see
// docs/SOURCE_OF_TRUTH.md §2.11. Anonymous: no auth header, no token.
export const submitQuoteRequest = async (payload) => {
  const { data } = await apiClient.post('/api/public/quote-requests', payload);
  return data.data;
};
