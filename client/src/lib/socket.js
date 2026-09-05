import { io } from 'socket.io-client';

// One chat feature, two token audiences — mirrors api/client.js (staff) and
// api/portal.js (customer) keeping their tokens strictly separate. The
// socket is opened lazily by whichever chat UI mounts, and closed when it
// unmounts; there is no app-wide persistent connection.
export const connectChatSocket = (token, audience) =>
  io(import.meta.env.VITE_API_URL, {
    auth: { token, audience },
    autoConnect: true,
    transports: ['websocket', 'polling'],
  });
