import { Router } from 'express';

import { validateQuery } from '../../middleware/validate.js';
import * as recommendationController from './recommendation.controller.js';
import { suggestSchema } from './recommendation.validator.js';

// Mounted at /api/public/product-recommendations by app.js. No auth — same
// evaluator as the internal /suggest, margin fields stripped (§6: margin
// never reaches a customer-facing view).
const router = Router();

router.get('/suggest', validateQuery(suggestSchema), recommendationController.suggestPublic);

export default router;
