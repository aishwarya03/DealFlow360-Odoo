import { Router } from 'express';

import { authenticateInternal } from '../../middleware/authenticate.js';
import authorize from '../../middleware/authorize.js';
import parseId from '../../middleware/parseId.js';
import validate, { validateQuery } from '../../middleware/validate.js';
import * as approvalController from './approval.controller.js';
import { actOnStepSchema, listApprovalsSchema } from './approval.validator.js';

// Mounted at /api/internal/approvals by app.js.
//
// Sales Rep never reaches this tree — approving/rejecting/returning is
// exactly the capability the brief keeps away from the person who built the
// quotation (§6). Sales Manager and Finance each see and act on their own
// stage only (scoped inside the service); Admin can act on either.
const router = Router();

router.use(authenticateInternal, authorize('SALES_MANAGER', 'FINANCE', 'ADMIN'));

router.get('/', validateQuery(listApprovalsSchema), approvalController.list);
router.get('/:id', parseId(), approvalController.getOne);

router.post(
  '/:id/steps/:stepId/act',
  parseId(),
  parseId('stepId'),
  validate(actOnStepSchema),
  approvalController.act
);

export default router;
