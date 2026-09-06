import { io } from 'socket.io-client';

// One chat feature, two token audiences — mirrors api/client.js (staff) and
// api/portal.js (customer) keeping their tokens strictly separate.
//
// Shared per audience, ref-counted, rather than one socket per consumer: the
// always-on notification listener (useChatNotifications) and whichever
// ChatPanel happens to be open both need a live connection to the same
// conversation rooms, and opening a second socket per tab would double every
// room join and every "is anyone here" presence count.
const sockets = { portal: null, internal: null };
const refCounts = { portal: 0, internal: 0 };

export const acquireChatSocket = (token, audience) => {
  if (!sockets[audience]) {
    sockets[audience] = io(import.meta.env.VITE_API_URL, {
      auth: { token, audience },
      transports: ['websocket', 'polling'],
    });
  }
  refCounts[audience] += 1;
  return sockets[audience];
};

// Only actually disconnects once every consumer has released it.
export const releaseChatSocket = (audience) => {
  refCounts[audience] = Math.max(0, refCounts[audience] - 1);
  if (refCounts[audience] === 0 && sockets[audience]) {
    sockets[audience].disconnect();
    sockets[audience] = null;
  }
};
