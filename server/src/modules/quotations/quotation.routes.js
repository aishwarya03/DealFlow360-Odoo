import { Router } from 'express';

import { authenticateInternal } from '../../middleware/authenticate.js';
import authorize from '../../middleware/authorize.js';
import parseId from '../../middleware/parseId.js';
import validate, { validateQuery } from '../../middleware/validate.js';
import * as quotationController from './quotation.controller.js';
import {
  actionNoteSchema,
  createQuotationSchema,
  listQuotationsSchema,
  updateLinesSchema,
} from './quotation.validator.js';

// Mounted at /api/internal/quotations by app.js.
//
// Create/edit/submit is Sales Rep + Sales Manager only, per the access matrix
// (§6): a quotation is a rep's own work in progress, not something Finance or
// even Admin reaches in on. Reads are open to any authenticated staff member —
// ownership scoping for Sales Rep happens inside the service (a rep only ever
// sees their own), not here.
const router = Router();

router.use(authenticateInternal);

router.get('/', validateQuery(listQuotationsSchema), quotationController.list);
router.get('/:id', parseId(), quotationController.getOne);

router.post(
  '/',
  authorize('SALES_REP', 'SALES_MANAGER'),
  validate(createQuotationSchema),
  quotationController.create
);

router.patch(
  '/:id/lines',
  authorize('SALES_REP', 'SALES_MANAGER'),
  parseId(),
  validate(updateLinesSchema),
  quotationController.updateLines
);

router.post(
  '/:id/submit',
  authorize('SALES_REP', 'SALES_MANAGER'),
  parseId(),
  quotationController.submit
);

// Customer decisions, recorded by a rep — no customer portal yet (§1.6,
// SOURCE_OF_TRUTH §7). Same authorization as the rest of this file; these
// become portal-authenticated, customer-triggered endpoints once that slice
// is built, without the service logic underneath needing to change.
router.post(
  '/:id/confirm',
  authorize('SALES_REP', 'SALES_MANAGER'),
  parseId(),
  validate(actionNoteSchema),
  quotationController.confirm
);

router.post(
  '/:id/withdraw',
  authorize('SALES_REP', 'SALES_MANAGER'),
  parseId(),
  validate(actionNoteSchema),
  quotationController.withdraw
);

// Manual fulfillment checkpoints (§ dispatchedAt/deliveredAt on the schema)
// — same authorization as the rest of a rep's own quotation actions.
// Delivered is the one that generates the one-time Invoice.
router.post('/:id/dispatch', authorize('SALES_REP', 'SALES_MANAGER'), parseId(), quotationController.dispatch);
router.post('/:id/deliver', authorize('SALES_REP', 'SALES_MANAGER'), parseId(), quotationController.deliver);

export default router;
