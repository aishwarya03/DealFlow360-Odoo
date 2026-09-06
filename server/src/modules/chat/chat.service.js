import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { getIO } from '../../realtime/socket.js';
import * as presence from './presence.service.js';

const COLLABORATOR_ROLES = ['SALES_REP', 'SALES_MANAGER'];

const conversationRoom = (id) => `conversation:${id}`;
const userRoom = (id) => `user:${id}`;

const toPublicParticipant = (participant) => ({
  id: participant.user.id,
  name: participant.user.name,
  role: participant.user.role,
});

const toPublicMessage = (message) => ({
  id: message.id,
  conversationId: message.conversationId,
  senderType: message.senderType,
  senderUser: message.senderUser
    ? { id: message.senderUser.id, name: message.senderUser.name }
    : null,
  senderCustomer: message.senderCustomer
    ? { id: message.senderCustomer.id, name: message.senderCustomer.name }
    : null,
  body: message.body,
  createdAt: message.createdAt,
});

const toPublicConversation = (conversation) => ({
  id: conversation.id,
  quotationId: conversation.quotationId,
  customerId: conversation.customerId,
  status: conversation.status,
  participants: conversation.participants?.map(toPublicParticipant) ?? [],
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

const conversationInclude = {
  participants: { include: { user: { select: { id: true, name: true, role: true } } } },
};

// Broadcasting is best-effort: a socket server that hasn't been initialized
// yet (or a test run without one) must never break the REST action itself.
const emitToRoom = (room, event, payload) => {
  try {
    getIO().to(room).emit(event, payload);
  } catch {
    // No socket server running — nothing to broadcast to.
  }
};

/**
 * Finds (or starts) the one conversation a quotation ever has. If a rep is
 * already reachable — preferring the quotation's own owner, since that's the
 * relationship the customer already has — the conversation goes straight to
 * ACTIVE with that rep attached. Otherwise it's created PENDING and sits in
 * the claim queue until someone comes online.
 */
export const startOrGetConversation = async (quotationId, customer) => {
  const quotation = await prisma.quotation.findUnique({ where: { id: quotationId } });
  if (!quotation || quotation.customerId !== customer.id) {
    throw ApiError.notFound('Quotation not found');
  }

  const existing = await prisma.chatConversation.findUnique({
    where: { quotationId },
    include: conversationInclude,
  });
  if (existing) return { conversation: toPublicConversation(existing), noOneAvailable: false };

  let assignedRepId = null;
  if (presence.isRepOnline(quotation.ownerId)) {
    assignedRepId = quotation.ownerId;
  } else {
    const onlineRep = await prisma.user.findFirst({
      where: {
        id: { in: presence.listOnlineRepIds() },
        role: { in: COLLABORATOR_ROLES },
        isActive: true,
      },
      orderBy: { id: 'asc' },
    });
    assignedRepId = onlineRep?.id ?? null;
  }

  const created = await prisma.chatConversation.create({
    data: {
      quotationId,
      customerId: customer.id,
      status: assignedRepId ? 'ACTIVE' : 'PENDING',
      participants: assignedRepId ? { create: [{ userId: assignedRepId }] } : undefined,
    },
    include: conversationInclude,
  });

  if (assignedRepId) {
    emitToRoom(userRoom(assignedRepId), 'chat:assigned', { conversationId: created.id });
  } else {
    for (const repId of presence.listOnlineRepIds()) {
      emitToRoom(userRoom(repId), 'chat:queue:updated', { conversationId: created.id });
    }
  }

  return {
    conversation: toPublicConversation(created),
    noOneAvailable: !assignedRepId,
  };
};

// Read by the rep's own toggle on load, and flipped by the same toggle —
// deliberately thin wrappers so callers only ever import chat.service.js,
// never presence.service.js directly.
export const getMyPresence = (userId) => ({ away: presence.isAway(userId) });

export const setMyPresence = (userId, away) => {
  presence.setAway(userId, away);
  return { away };
};

export const listQueue = async () =>
  (
    await prisma.chatConversation.findMany({
      where: { status: 'PENDING' },
      include: { ...conversationInclude, quotation: { select: { id: true } }, customer: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    })
  ).map((c) => ({ ...toPublicConversation(c), customer: c.customer }));

export const listMine = async (actingUser) =>
  (
    await prisma.chatConversation.findMany({
      where: { participants: { some: { userId: actingUser.id } } },
      include: { ...conversationInclude, customer: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    })
  ).map((c) => ({ ...toPublicConversation(c), customer: c.customer }));

export const claimConversation = async (conversationId, actingUser) => {
  const conversation = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw ApiError.notFound('Conversation not found');
  if (conversation.status !== 'PENDING') {
    throw ApiError.badRequest('This conversation has already been claimed');
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.chatParticipant.create({ data: { conversationId, userId: actingUser.id } });
    return tx.chatConversation.update({
      where: { id: conversationId },
      data: { status: 'ACTIVE' },
      include: conversationInclude,
    });
  });

  emitToRoom(conversationRoom(conversationId), 'chat:assigned', {
    conversationId,
    rep: { id: actingUser.id },
  });

  return toPublicConversation(updated);
};

const assertParticipant = async (conversationId, userId) => {
  const participant = await prisma.chatParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) throw ApiError.forbidden('You are not part of this conversation');
};

export const addParticipant = async (conversationId, targetUserId, actingUser) => {
  await assertParticipant(conversationId, actingUser.id);

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser || !targetUser.isActive || !COLLABORATOR_ROLES.includes(targetUser.role)) {
    throw ApiError.badRequest('That user cannot be added to this chat');
  }

  const already = await prisma.chatParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
  });
  if (already) throw ApiError.conflict(`${targetUser.name} is already in this chat`);

  const systemMessage = await prisma.$transaction(async (tx) => {
    await tx.chatParticipant.create({ data: { conversationId, userId: targetUserId } });
    const message = await tx.chatMessage.create({
      data: {
        conversationId,
        senderType: 'SYSTEM',
        body: `${actingUser.name ?? 'A team member'} added ${targetUser.name} to the chat`,
      },
    });
    await tx.chatConversation.update({ where: { id: conversationId }, data: {} });
    return message;
  });

  emitToRoom(userRoom(targetUserId), 'chat:assigned', { conversationId });
  emitToRoom(conversationRoom(conversationId), 'chat:participant:added', {
    conversationId,
    participant: { id: targetUser.id, name: targetUser.name, role: targetUser.role },
  });
  emitToRoom(conversationRoom(conversationId), 'chat:message', toPublicMessage(systemMessage));

  return { id: targetUser.id, name: targetUser.name, role: targetUser.role };
};

export const listCollaboratorCandidates = async (conversationId) => {
  const existingIds = (
    await prisma.chatParticipant.findMany({ where: { conversationId }, select: { userId: true } })
  ).map((p) => p.userId);

  const users = await prisma.user.findMany({
    where: { role: { in: COLLABORATOR_ROLES }, isActive: true, id: { notIn: existingIds } },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  });

  return users.map((u) => ({ ...u, online: presence.isRepOnline(u.id) }));
};

export const assertPortalAccess = async (conversationId, customerId) => {
  const conversation = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.customerId !== customerId) {
    throw ApiError.notFound('Conversation not found');
  }
  return conversation;
};

export const assertInternalAccess = async (conversationId, userId) => {
  const conversation = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw ApiError.notFound('Conversation not found');
  await assertParticipant(conversationId, userId);
  return conversation;
};

export const listMessages = async (conversationId, requester) => {
  if (requester.audience === 'portal') {
    await assertPortalAccess(conversationId, requester.id);
  } else {
    await assertInternalAccess(conversationId, requester.id);
  }

  const messages = await prisma.chatMessage.findMany({
    where: { conversationId },
    include: {
      senderUser: { select: { id: true, name: true } },
      senderCustomer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return messages.map(toPublicMessage);
};

/**
 * Shared by the REST-less socket path (chat:message) — there is no REST
 * "send message" endpoint, this is the only way a message is ever created.
 */
export const postMessage = async (conversationId, sender, body) => {
  if (sender.audience === 'portal') {
    await assertPortalAccess(conversationId, sender.id);
  } else {
    await assertInternalAccess(conversationId, sender.id);
  }

  const message = await prisma.chatMessage.create({
    data: {
      conversationId,
      senderType: sender.audience === 'portal' ? 'CUSTOMER' : 'USER',
      senderCustomerId: sender.audience === 'portal' ? sender.id : null,
      senderUserId: sender.audience === 'internal' ? sender.id : null,
      body,
    },
    include: {
      senderUser: { select: { id: true, name: true } },
      senderCustomer: { select: { id: true, name: true } },
    },
  });

  await prisma.chatConversation.update({ where: { id: conversationId }, data: {} });

  const publicMessage = toPublicMessage(message);
  emitToRoom(conversationRoom(conversationId), 'chat:message', publicMessage);

  return publicMessage;
};
