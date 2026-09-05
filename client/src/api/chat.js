import apiClient from './client';
import { getPortalToken } from './portal';

// ── Portal (customer) ────────────────────────────────────────────────────

export const startChat = async (quotationId) => {
  const { data } = await apiClient.post(
    `/api/portal/quotations/${quotationId}/chat/start`,
    {},
    { headers: { Authorization: `Bearer ${getPortalToken()}` } }
  );
  return data.data;
};

export const listMyChatMessages = async (conversationId) => {
  const { data } = await apiClient.get(`/api/portal/chat/${conversationId}/messages`, {
    headers: { Authorization: `Bearer ${getPortalToken()}` },
  });
  return data.data.messages;
};

// ── Internal (staff) ─────────────────────────────────────────────────────

export const listChatQueue = async () => {
  const { data } = await apiClient.get('/api/internal/chat/queue');
  return data.data.conversations;
};

export const listMyChats = async () => {
  const { data } = await apiClient.get('/api/internal/chat/mine');
  return data.data.conversations;
};

export const claimChat = async (conversationId) => {
  const { data } = await apiClient.post(`/api/internal/chat/${conversationId}/claim`);
  return data.data.conversation;
};

export const listChatMessages = async (conversationId) => {
  const { data } = await apiClient.get(`/api/internal/chat/${conversationId}/messages`);
  return data.data.messages;
};

export const listCollaboratorCandidates = async (conversationId) => {
  const { data } = await apiClient.get(`/api/internal/chat/${conversationId}/collaborators`);
  return data.data.candidates;
};

export const addChatParticipant = async (conversationId, userId) => {
  const { data } = await apiClient.post(`/api/internal/chat/${conversationId}/participants`, {
    userId,
  });
  return data.data.participant;
};
