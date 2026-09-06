import { Server } from 'socket.io';

import prisma from '../prisma/client.js';
import { AUDIENCE, verifyToken } from '../utils/jwt.js';
import * as presence from '../modules/chat/presence.service.js';

const conversationRoom = (id) => `conversation:${id}`;
const userRoom = (id) => `user:${id}`;

let io = null;

export const getIO = () => {
  if (!io) throw new Error('Socket.IO server has not been initialized yet');
  return io;
};

// Verifies the handshake token against the audience the client claims —
// same verifyToken() authenticate.js uses for REST, so a portal token can no
// more open an internal socket than it can call an internal route.
const authenticateSocket = (socket, next) => {
  const { token, audience } = socket.handshake.auth ?? {};
  const audienceValue = audience === 'internal' ? AUDIENCE.INTERNAL : AUDIENCE.PORTAL;

  if (!token) return next(new Error('No token provided'));

  try {
    const decoded = verifyToken(token, audienceValue);
    socket.data.user = {
      id: Number(decoded.sub),
      audience: audience === 'internal' ? 'internal' : 'portal',
      role: decoded.role,
      name: decoded.name,
    };
    return next();
  } catch {
    return next(new Error('Invalid or expired token'));
  }
};

const joinOwnConversations = async (socket) => {
  const { id, audience } = socket.data.user;

  const conversations =
    audience === 'internal'
      ? await prisma.chatConversation.findMany({
          where: { participants: { some: { userId: id } } },
          select: { id: true },
        })
      : await prisma.chatConversation.findMany({
          where: { customerId: id },
          select: { id: true },
        });

  return conversations.map(({ id: conversationId }) => {
    socket.join(conversationRoom(conversationId));
    return conversationId;
  });
};

// "Is a customer here right now" / "is a rep here right now" for one
// conversation — a per-room, live-connection read, distinct from the app-wide
// isRepOnline() in presence.service.js. A customer only ever holds a socket
// while a chat panel is open, so this doubles as "chat window open" for them;
// for a rep it's closer to "currently signed into the app" since they're
// auto-joined to every conversation they participate in on connect.
const roomPresence = (io, conversationId) => {
  const socketIds = io.sockets.adapter.rooms.get(conversationRoom(conversationId)) ?? new Set();
  let customerOnline = false;
  let repOnline = false;

  for (const socketId of socketIds) {
    const user = io.sockets.sockets.get(socketId)?.data.user;
    if (user?.audience === 'portal' && presence.isCustomerOnline(user.id)) customerOnline = true;
    if (user?.audience === 'internal' && presence.isRepOnline(user.id)) repOnline = true;
  }

  return { conversationId, customerOnline, repOnline };
};

const broadcastPresence = (io, conversationId) => {
  io.to(conversationRoom(conversationId)).emit('chat:presence', roomPresence(io, conversationId));
};

// Lazily imported so this module and chat.service.js (which imports getIO
// from here) don't have to agree on load order.
const chatServicePromise = import('../modules/chat/chat.service.js');

export const initSocket = (httpServer) => {
  io = new Server(httpServer, { cors: { origin: '*' } });

  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    const { id, audience, name } = socket.data.user;

    if (audience === 'internal') {
      presence.markOnline(id, socket.id);
      socket.join(userRoom(id));
    } else {
      presence.markCustomerOnline(id, socket.id);
    }
    socket.emit('chat:availability', {
      audience,
      available: audience === 'internal' ? presence.isRepOnline(id) : presence.isCustomerOnline(id),
    });

    // Every conversation room this socket is currently in — auto-joined ones
    // from connect plus any joined later via chat:join — so disconnect knows
    // which rooms to recompute presence for without asking the adapter to
    // guess which conversation a socket.io room name maps back to.
    const joinedConversationIds = new Set(await joinOwnConversations(socket));
    for (const conversationId of joinedConversationIds) {
      broadcastPresence(io, conversationId);
    }

    socket.on('chat:join', async ({ conversationId }, ack) => {
      try {
        const chatService = await chatServicePromise;
        if (audience === 'portal') {
          await chatService.assertPortalAccess(conversationId, id);
        } else {
          await chatService.assertInternalAccess(conversationId, id);
        }
        socket.join(conversationRoom(conversationId));
        joinedConversationIds.add(conversationId);

        const presenceSnapshot = roomPresence(io, conversationId);
        ack?.({ ok: true, presence: presenceSnapshot });
        // Tell whoever was already in the room (if anyone) that this side
        // just joined — the joiner already has the snapshot via the ack.
        socket.to(conversationRoom(conversationId)).emit('chat:presence', presenceSnapshot);
      } catch (error) {
        ack?.({ ok: false, message: error.message });
      }
    });

    socket.on('chat:availability', ({ available }, ack) => {
      if (typeof available !== 'boolean') {
        ack?.({ ok: false, message: 'Availability must be a boolean' });
        return;
      }

      if (audience === 'internal') presence.setAway(id, !available);
      else presence.setCustomerAway(id, !available);

      for (const conversationId of joinedConversationIds) {
        broadcastPresence(io, conversationId);
      }
      ack?.({ ok: true, available });
    });

    socket.on('chat:message', async ({ conversationId, body }, ack) => {
      try {
        const chatService = await chatServicePromise;
        const message = await chatService.postMessage(conversationId, { id, audience, name }, body);
        ack?.({ ok: true, message });
      } catch (error) {
        ack?.({ ok: false, message: error.message });
      }
    });

    socket.on('disconnect', () => {
      if (audience === 'internal') presence.markOffline(id, socket.id);
      else presence.markCustomerOffline(id, socket.id);
      // By the time 'disconnect' fires, socket.io has already removed this
      // socket from every room's membership, so roomPresence() below
      // correctly reflects its absence.
      for (const conversationId of joinedConversationIds) {
        broadcastPresence(io, conversationId);
      }
    });
  });

  return io;
};
