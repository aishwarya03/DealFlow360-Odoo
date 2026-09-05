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

  for (const { id: conversationId } of conversations) {
    socket.join(conversationRoom(conversationId));
  }
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
    }

    await joinOwnConversations(socket);

    socket.on('chat:join', async ({ conversationId }, ack) => {
      try {
        const chatService = await chatServicePromise;
        if (audience === 'portal') {
          await chatService.assertPortalAccess(conversationId, id);
        } else {
          await chatService.assertInternalAccess(conversationId, id);
        }
        socket.join(conversationRoom(conversationId));
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: error.message });
      }
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
    });
  });

  return io;
};
