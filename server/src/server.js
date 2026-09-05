// Must be first: validates and loads env before any module that reads it at
// import time (the Prisma client and the JWT utils both do).
import env from './config/env.js';

import http from 'http';

import app from './app.js';
import { initSocket } from './realtime/socket.js';

// Express and Socket.IO share one HTTP server so the chat feature needs no
// second port or separate CORS/deploy story.
const server = http.createServer(app);
initSocket(server);

server.listen(env.PORT, () => {
  console.log(`DealFlow360 API running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});
