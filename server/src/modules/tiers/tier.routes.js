import { Router } from 'express';

import { authenticateInternal } from '../../middleware/authenticate.js';
import authorize from '../../middleware/authorize.js';
import parseId from '../../middleware/parseId.js';
import validate, { validateQuery } from '../../middleware/validate.js';
import * as tierController from './tier.controller.js';
import {
  createTierSchema,
  listTiersSchema,
  updateScoringConfigSchema,
  updateTierSchema,
} from './tier.validator.js';

// Mounted at /api/internal/tiers by app.js.
// Reads open to all staff (a rep sees which tier a customer is on); tier setup
// is admin configuration, same as categories and discount rules.
const router = Router();

router.use(authenticateInternal);

// Literal paths before /:id so they are not parsed as ids.
router.get('/scoring-config', tierController.getScoringConfig);
router.patch(
  '/scoring-config',
  authorize('ADMIN'),
  validate(updateScoringConfigSchema),
  tierController.updateScoringConfig
);
router.post('/recalculate', authorize('ADMIN'), tierController.recalculateAll);

router.get('/', validateQuery(listTiersSchema), tierController.list);
router.get('/:id', parseId(), tierController.getOne);

router.post('/', authorize('ADMIN'), validate(createTierSchema), tierController.create);

router.patch(
  '/:id',
  authorize('ADMIN'),
  parseId(),
  validate(updateTierSchema),
  tierController.update
);

router.delete('/:id', authorize('ADMIN'), parseId(), tierController.deactivate);

export default router;
