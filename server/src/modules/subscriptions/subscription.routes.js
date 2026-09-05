import { Router } from 'express';

import { authenticateInternal } from '../../middleware/authenticate.js';
import authorize from '../../middleware/authorize.js';
import parseId from '../../middleware/parseId.js';
import validate, { validateQuery } from '../../middleware/validate.js';
import * as subscriptionController from './subscription.controller.js';
import {
  cancelSchema,
  listSubscriptionsSchema,
  planChangeSchema,
  quantityChangeSchema,
} from './subscription.validator.js';

// Mounted at /api/internal/subscriptions by app.js. Read/manage access for
// every staff role that touches an account (mirrors quotations); billing
// oversight (nav item) is ADMIN + FINANCE only, but this stays open to the
// same population as quotations since a rep may need to action a change a
// customer asked for over chat/phone.
const router = Router();

router.use(authenticateInternal);

router.get('/', validateQuery(listSubscriptionsSchema), subscriptionController.list);
router.get('/:id', parseId(), subscriptionController.getOne);

router.post(
  '/:id/quantity-change/preview',
  parseId(),
  validate(quantityChangeSchema),
  subscriptionController.previewQuantityChange
);
router.post(
  '/:id/quantity-change',
  parseId(),
  validate(quantityChangeSchema),
  subscriptionController.applyQuantityChange
);

router.post(
  '/:id/plan-change/preview',
  parseId(),
  validate(planChangeSchema),
  subscriptionController.previewPlanChange
);
router.post('/:id/plan-change', parseId(), validate(planChangeSchema), subscriptionController.applyPlanChange);

router.post('/:id/cancel/preview', parseId(), validate(cancelSchema), subscriptionController.previewCancel);
router.post('/:id/cancel', parseId(), validate(cancelSchema), subscriptionController.cancel);

// Manual trigger for the same billing sweep server.js runs on a timer —
// useful for an admin who wants to force a renewal cycle without waiting.
router.post('/run-billing', authorize('ADMIN'), subscriptionController.runBilling);

export default router;
