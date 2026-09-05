import { Router } from 'express';

import { authenticateInternal } from '../../middleware/authenticate.js';
import authorize from '../../middleware/authorize.js';
import parseId from '../../middleware/parseId.js';
import validate, { validateQuery } from '../../middleware/validate.js';
import * as recommendationController from './recommendation.controller.js';
import {
  createRecommendationSchema,
  listRecommendationsSchema,
  suggestSchema,
  updateRecommendationSchema,
} from './recommendation.validator.js';

// Mounted at /api/internal/product-recommendations by app.js.
//
// Reading is open to all staff — a rep needs suggestions while building a
// quotation, same reasoning as discount policy being staff-readable.
// Writing is Admin-only: this is catalog configuration, the same bucket as
// DiscountRule/CategoryDiscountCeiling.
const router = Router();

router.use(authenticateInternal);

// Declared before /:id so the literal path isn't read as an id.
router.get('/suggest', validateQuery(suggestSchema), recommendationController.suggest);

router.get('/', validateQuery(listRecommendationsSchema), recommendationController.list);
router.get('/:id', parseId(), recommendationController.getOne);

router.post(
  '/',
  authorize('ADMIN'),
  validate(createRecommendationSchema),
  recommendationController.create
);

router.patch(
  '/:id',
  authorize('ADMIN'),
  parseId(),
  validate(updateRecommendationSchema),
  recommendationController.update
);

router.delete('/:id', authorize('ADMIN'), parseId(), recommendationController.deactivate);

export default router;
