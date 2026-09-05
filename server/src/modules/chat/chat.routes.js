import { Router } from 'express';

import { authenticateInternal } from '../../middleware/authenticate.js';
import authorize from '../../middleware/authorize.js';
import parseId from '../../middleware/parseId.js';
import validate from '../../middleware/validate.js';
import * as chatController from './chat.controller.js';
import { addParticipantSchema } from './chat.validator.js';

// Mounted at /api/internal/chat by app.js.
//
// Sales-scoped like quotations themselves (§6) — Finance/Admin have no reason
// to be pulled into a customer chat, so this whole tree is Rep + Manager only,
// same as quotation create/edit.
const router = Router();

router.use(authenticateInternal, authorize('SALES_REP', 'SALES_MANAGER'));

router.get('/queue', chatController.listQueue);
router.get('/mine', chatController.listMine);

router.post('/:id/claim', parseId(), chatController.claim);
router.get('/:id/messages', parseId(), chatController.listMessagesInternal);
router.get('/:id/collaborators', parseId(), chatController.listCollaboratorCandidates);
router.post(
  '/:id/participants',
  parseId(),
  validate(addParticipantSchema),
  chatController.addParticipant
);

export default router;
