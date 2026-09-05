import { sendSuccess } from '../../utils/apiResponse.js';
import * as chatService from './chat.service.js';

// ── Internal (staff) ─────────────────────────────────────────────────────

export const listQueue = async (req, res) => {
  const conversations = await chatService.listQueue();
  sendSuccess(res, 'Unclaimed chats', { conversations, count: conversations.length });
};

export const listMine = async (req, res) => {
  const conversations = await chatService.listMine(req.user);
  sendSuccess(res, 'Your chats', { conversations, count: conversations.length });
};

export const claim = async (req, res) => {
  const conversation = await chatService.claimConversation(req.params.id, req.user);
  sendSuccess(res, 'Conversation claimed', { conversation });
};

export const addParticipant = async (req, res) => {
  const participant = await chatService.addParticipant(req.params.id, req.body.userId, req.user);
  sendSuccess(res, 'Collaborator added', { participant }, 201);
};

export const listCollaboratorCandidates = async (req, res) => {
  const candidates = await chatService.listCollaboratorCandidates(req.params.id);
  sendSuccess(res, 'Collaborator candidates', { candidates });
};

export const listMessagesInternal = async (req, res) => {
  const messages = await chatService.listMessages(req.params.id, {
    audience: 'internal',
    id: req.user.id,
  });
  sendSuccess(res, 'Messages', { messages });
};

// ── Portal (customer) ────────────────────────────────────────────────────

export const startChat = async (req, res) => {
  const { conversation, noOneAvailable } = await chatService.startOrGetConversation(
    req.params.id,
    req.user
  );
  sendSuccess(res, noOneAvailable ? 'No one is available right now' : 'Conversation ready', {
    conversation,
    noOneAvailable,
  });
};

export const listMessagesPortal = async (req, res) => {
  const messages = await chatService.listMessages(req.params.id, {
    audience: 'portal',
    id: req.user.id,
  });
  sendSuccess(res, 'Messages', { messages });
};
