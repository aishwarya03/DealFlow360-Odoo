import { Router } from 'express';

import { authenticateInternal } from '../../middleware/authenticate.js';
import authorize from '../../middleware/authorize.js';
import parseId from '../../middleware/parseId.js';
import validate, { validateQuery } from '../../middleware/validate.js';
import * as vendorController from './vendor.controller.js';
import { createVendorSchema, listVendorsSchema, updateVendorSchema } from './vendor.validator.js';

// Mounted at /api/internal/vendors by app.js.
// Reads open to all staff — picking a vendor for a backorder is part of the
// ordinary workspace flow. Vendor setup itself is backend configuration, so
// writes are admin-only, same split as warehouses/products.
const router = Router();

router.use(authenticateInternal);

router.get('/', validateQuery(listVendorsSchema), vendorController.list);
router.get('/:id', parseId(), vendorController.getOne);

router.post('/', authorize('ADMIN'), validate(createVendorSchema), vendorController.create);

router.patch(
  '/:id',
  authorize('ADMIN'),
  parseId(),
  validate(updateVendorSchema),
  vendorController.update
);

router.delete('/:id', authorize('ADMIN'), parseId(), vendorController.deactivate);

export default router;
