import { Router } from 'express';

import { authenticateInternal } from '../../middleware/authenticate.js';
import authorize from '../../middleware/authorize.js';
import parseId from '../../middleware/parseId.js';
import validate, { validateQuery } from '../../middleware/validate.js';
import * as categoryController from './category.controller.js';
import {
  createCategorySchema,
  listCategoriesSchema,
  updateCategorySchema,
} from './category.validator.js';

// Mounted at /api/internal/categories by app.js.
// Reads open to all staff — a rep needs the tree to file a product or read a
// report. Category setup is backend configuration (brief A3), so writes are
// admin-only, same as Products and Warehouses.
const router = Router();

router.use(authenticateInternal);

router.get('/', validateQuery(listCategoriesSchema), categoryController.list);
router.get('/tree', categoryController.tree);
router.get('/:id', parseId(), categoryController.getOne);

router.post('/', authorize('ADMIN'), validate(createCategorySchema), categoryController.create);

router.patch(
  '/:id',
  authorize('ADMIN'),
  parseId(),
  validate(updateCategorySchema),
  categoryController.update
);

router.delete('/:id', authorize('ADMIN'), parseId(), categoryController.remove);

export default router;
