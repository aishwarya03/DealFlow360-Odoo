import { Router } from 'express';

import parseId from '../../middleware/parseId.js';
import { validateQuery } from '../../middleware/validate.js';
import * as productController from './product.controller.js';
import { listProductsSchema } from './product.validator.js';

const router = Router();

router.get('/', validateQuery(listProductsSchema), productController.publicList);
router.get('/:id', parseId(), productController.publicGetOne);

export default router;