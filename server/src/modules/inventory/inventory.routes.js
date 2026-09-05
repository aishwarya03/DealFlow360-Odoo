import { Router } from 'express';

import { authenticateInternal } from '../../middleware/authenticate.js';
import authorize from '../../middleware/authorize.js';
import parseId from '../../middleware/parseId.js';
import validate, { validateQuery } from '../../middleware/validate.js';
import * as inventoryController from './inventory.controller.js';
import {
  adjustStockSchema,
  allocationSuggestionSchema,
  listStockSchema,
  setStockSchema,
} from './inventory.validator.js';

// Mounted at /api/internal/inventory by app.js.
//
// Reads are open to all staff: a rep quoting a customer needs to know what can
// actually be delivered. Writes belong to ADMIN and FINANCE — the spec puts
// warehouse and backorder decisions with Finance/Operations, and stock balances
// are not something a rep should be able to move to make a deal work.
const router = Router();

router.use(authenticateInternal);

router.get('/', validateQuery(listStockSchema), inventoryController.list);
router.get('/low-stock', inventoryController.lowStock);
router.get('/movements', validateQuery(listStockSchema), inventoryController.movements);
router.get(
  '/allocation-suggestion',
  validateQuery(allocationSuggestionSchema),
  inventoryController.allocationSuggestion
);

// Declared after /low-stock and /movements so those literal paths are not
// swallowed by the parameterised route.
router.get(
  '/availability/:productId',
  parseId('productId'),
  inventoryController.availability
);

router.put(
  '/',
  authorize('ADMIN', 'FINANCE'),
  validate(setStockSchema),
  inventoryController.set
);

router.post(
  '/adjust',
  authorize('ADMIN', 'FINANCE'),
  validate(adjustStockSchema),
  inventoryController.adjust
);

export default router;
