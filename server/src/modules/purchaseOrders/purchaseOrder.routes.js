import { Router } from 'express';

import { authenticateInternal } from '../../middleware/authenticate.js';
import authorize from '../../middleware/authorize.js';
import parseId from '../../middleware/parseId.js';
import validate, { validateQuery } from '../../middleware/validate.js';
import * as purchaseOrderController from './purchaseOrder.controller.js';
import {
  createPurchaseOrderSchema,
  listPurchaseOrdersSchema,
  updatePurchaseOrderSchema,
} from './purchaseOrder.validator.js';

// Mounted at /api/internal/purchase-orders by app.js.
// Reads open to all staff — anyone in the workspace needs to see a backorder's
// progress. Placing, editing and advancing an order is admin-only, same split
// as the other stock-affecting write paths (inventory adjustments, warehouses).
const router = Router();

router.use(authenticateInternal);

router.get('/', validateQuery(listPurchaseOrdersSchema), purchaseOrderController.list);
router.get('/:id', parseId(), purchaseOrderController.getOne);

router.post(
  '/',
  authorize('ADMIN'),
  validate(createPurchaseOrderSchema),
  purchaseOrderController.create
);

router.patch(
  '/:id',
  authorize('ADMIN'),
  parseId(),
  validate(updatePurchaseOrderSchema),
  purchaseOrderController.update
);

router.post('/:id/order', authorize('ADMIN'), parseId(), purchaseOrderController.order);
router.post('/:id/complete', authorize('ADMIN'), parseId(), purchaseOrderController.complete);
router.post('/:id/cancel', authorize('ADMIN'), parseId(), purchaseOrderController.cancel);

export default router;
