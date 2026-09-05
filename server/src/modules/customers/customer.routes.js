import { Router } from 'express';

import { authenticateInternal } from '../../middleware/authenticate.js';
import authorize from '../../middleware/authorize.js';
import parseId from '../../middleware/parseId.js';
import validate, { validateQuery } from '../../middleware/validate.js';
import * as customerController from './customer.controller.js';
import {
  createCustomerSchema,
  listCustomersSchema,
  updateCustomerSchema,
} from './customer.validator.js';

// Mounted at /api/internal/customers by app.js.
// Unlike the product catalog, reps create and edit customers — that is their job,
// not backend configuration. Deactivation stays with admins.
const router = Router();

router.use(authenticateInternal);

router.get('/', validateQuery(listCustomersSchema), customerController.list);
router.get('/:id', parseId(), customerController.getOne);
router.get('/:id/tier-score', parseId(), customerController.tierScore);

router.post(
  '/:id/recalculate-tier',
  authorize('ADMIN', 'SALES_MANAGER'),
  parseId(),
  customerController.recalculateTier
);

router.post(
  '/',
  authorize('ADMIN', 'SALES_REP', 'SALES_MANAGER'),
  validate(createCustomerSchema),
  customerController.create
);

router.patch(
  '/:id',
  authorize('ADMIN', 'SALES_REP', 'SALES_MANAGER'),
  parseId(),
  validate(updateCustomerSchema),
  customerController.update
);

router.delete(
  '/:id',
  authorize('ADMIN'),
  parseId(),
  customerController.deactivate
);

export default router;
