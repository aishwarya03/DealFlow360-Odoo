import { Router } from 'express';

import { authenticateInternal } from '../../middleware/authenticate.js';
import authorize from '../../middleware/authorize.js';
import parseId from '../../middleware/parseId.js';
import uploadProductImage from '../../middleware/uploadProductImage.js';
import validate, { validateQuery } from '../../middleware/validate.js';
import * as productController from './product.controller.js';
import {
  createProductSchema,
  listProductsSchema,
  updateProductSchema,
} from './product.validator.js';

// Mounted at /api/internal/products by app.js.
// Catalog reads are open to every signed-in staff member, because a rep cannot
// build a quotation without them. Writes are admin-only: the catalog is backend
// configuration, per the spec's Admin role.
const router = Router();

router.use(authenticateInternal);

router.get('/', validateQuery(listProductsSchema), productController.list);
router.get('/:id', parseId(), productController.getOne);

router.post(
  '/',
  authorize('ADMIN'),
  validate(createProductSchema),
  productController.create
);

router.patch(
  '/:id',
  authorize('ADMIN'),
  parseId(),
  validate(updateProductSchema),
  productController.update
);

// Soft delete. Hard deletion would orphan quotation lines that reference it.
router.delete(
  '/:id',
  authorize('ADMIN'),
  parseId(),
  productController.deactivate
);

router.post(
  '/:id/image',
  authorize('ADMIN'),
  parseId(),
  uploadProductImage,
  productController.uploadImage
);

export default router;
