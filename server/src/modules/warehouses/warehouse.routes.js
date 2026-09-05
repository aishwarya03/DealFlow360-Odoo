import { Router } from 'express';

import { authenticateInternal } from '../../middleware/authenticate.js';
import authorize from '../../middleware/authorize.js';
import parseId from '../../middleware/parseId.js';
import validate, { validateQuery } from '../../middleware/validate.js';
import * as warehouseController from './warehouse.controller.js';
import {
  createWarehouseSchema,
  listWarehousesSchema,
  updateWarehouseSchema,
} from './warehouse.validator.js';

// Mounted at /api/internal/warehouses by app.js.
// Reads are open to all staff — a rep needs to see where stock sits when a customer
// asks about delivery. Warehouse setup itself is backend configuration, so writes
// are admin-only.
const router = Router();

router.use(authenticateInternal);

router.get('/', validateQuery(listWarehousesSchema), warehouseController.list);
router.get('/:id', parseId(), warehouseController.getOne);

router.post(
  '/',
  authorize('ADMIN'),
  validate(createWarehouseSchema),
  warehouseController.create
);

router.patch(
  '/:id',
  authorize('ADMIN'),
  parseId(),
  validate(updateWarehouseSchema),
  warehouseController.update
);

router.delete(
  '/:id',
  authorize('ADMIN'),
  parseId(),
  warehouseController.deactivate
);

export default router;
