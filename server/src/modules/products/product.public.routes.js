import { Router } from 'express';

import { validateQuery } from '../../middleware/validate.js';
import * as productController from './product.controller.js';
import { listProductsSchema } from './product.validator.js';

const router = Router();

router.get('/', validateQuery(listProductsSchema), productController.publicList);

export default router;