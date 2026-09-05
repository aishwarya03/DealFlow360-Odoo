import { Router } from 'express';

import { authenticatePortal } from '../../middleware/authenticate.js';
import parseId from '../../middleware/parseId.js';
import validate from '../../middleware/validate.js';
import * as subscriptionController from './subscription.controller.js';
import { cancelSchema, planChangeSchema, quantityChangeSchema, rejectInvoiceSchema } from './subscription.validator.js';

// Mounted at /api/portal by app.js, alongside portal.routes.js. Every route
// here is scoped to req.user.id (the signed-in customer) inside the
// service layer — a customer can only ever see or change their own
// subscriptions, same "wrong id is a 404" rule as portal quotations.
const router = Router();

router.use(authenticatePortal);

router.get('/subscriptions', subscriptionController.listMine);
router.get('/subscriptions/:id', parseId(), subscriptionController.getMine);

router.post(
  '/subscriptions/:id/quantity-change/preview',
  parseId(),
  validate(quantityChangeSchema),
  subscriptionController.previewMyQuantityChange
);
router.post(
  '/subscriptions/:id/quantity-change',
  parseId(),
  validate(quantityChangeSchema),
  subscriptionController.applyMyQuantityChange
);

router.post(
  '/subscriptions/:id/plan-change/preview',
  parseId(),
  validate(planChangeSchema),
  subscriptionController.previewMyPlanChange
);
router.post(
  '/subscriptions/:id/plan-change',
  parseId(),
  validate(planChangeSchema),
  subscriptionController.applyMyPlanChange
);

router.post(
  '/subscriptions/:id/cancel/preview',
  parseId(),
  validate(cancelSchema),
  subscriptionController.previewMyCancel
);
router.post('/subscriptions/:id/cancel', parseId(), validate(cancelSchema), subscriptionController.cancelMine);

// The "ask for approval from the client" step — the customer confirms (or
// declines) the renewal invoice the billing scheduler raised.
router.post(
  '/subscriptions/:id/invoices/:invoiceId/approve',
  parseId(),
  parseId('invoiceId'),
  subscriptionController.approveInvoice
);
router.post(
  '/subscriptions/:id/invoices/:invoiceId/reject',
  parseId(),
  parseId('invoiceId'),
  validate(rejectInvoiceSchema),
  subscriptionController.rejectInvoice
);

export default router;
