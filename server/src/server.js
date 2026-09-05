// Must be first: validates and loads env before any module that reads it at
// import time (the Prisma client and the JWT utils both do).
import env from './config/env.js';

import app from './app.js';

app.listen(env.PORT, () => {
  console.log(`DealFlow360 API running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
});
