import { Router } from 'express';

import { authenticatePortal } from '../../middleware/authenticate.js';
import parseId from '../../middleware/parseId.js';
import * as chatController from './chat.controller.js';

// Mounted at /api/portal by app.js, alongside portal.routes.js — a separate
// file because chat is its own module, not because the audience differs.
const router = Router();

router.use(authenticatePortal);

router.post('/quotations/:id/chat/start', parseId(), chatController.startChat);
router.get('/chat/:id/messages', parseId(), chatController.listMessagesPortal);

export default router;
