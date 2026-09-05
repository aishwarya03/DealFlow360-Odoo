// Must be first: validates and loads env before any module that reads it at
// import time (the Prisma client and the JWT utils both do).
import env from './config/env.js';

import http from 'http';

import app from './app.js';
import { initSocket } from './realtime/socket.js';
import { runBillingCycle } from './modules/subscriptions/subscription.service.js';

// Express and Socket.IO share one HTTP server so the chat feature needs no
// second port or separate CORS/deploy story.
const server = http.createServer(app);
initSocket(server);

// The built-in renewal scheduler: no cron dependency, just a timer inside
// this process. Every tick raises a PENDING_APPROVAL invoice for whichever
// subscriptions have reached their nextBillingDate — see
// subscription.service.js#runBillingCycle for what "raises" means (never an
// actual charge, always waits on the customer). An hour is frequent enough
// that a due subscription is never far past due, without hammering the DB.
const BILLING_INTERVAL_MS = 60 * 60 * 1000;

const tickBilling = () => {
  runBillingCycle().catch((error) => console.error('Subscription billing cycle failed:', error));
};

server.listen(env.PORT, () => {
  console.log(`DealFlow360 API running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  tickBilling();
  setInterval(tickBilling, BILLING_INTERVAL_MS);
});
