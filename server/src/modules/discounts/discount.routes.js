import { Router } from 'express';

import { authenticateInternal } from '../../middleware/authenticate.js';
import authorize from '../../middleware/authorize.js';
import parseId from '../../middleware/parseId.js';
import validate, { validateQuery } from '../../middleware/validate.js';
import * as discountController from './discount.controller.js';
import {
  createRuleSchema,
  evaluateSchema,
  listRulesSchema,
  resolveRuleSchema,
  updateRuleSchema,
} from './discount.validator.js';

// Mounted at /api/internal/discounts by app.js.
//
// Reading policy is open to all staff — a rep needs to know a ceiling before
// they discount, and an approver needs to see why a quote routed to them.
// Writing policy is admin-only: discount governance is exactly the kind of
// configuration the brief puts behind Admin (§A3), and a rep who could raise
// their own ceiling would make the whole engine decorative.
const router = Router();

router.use(authenticateInternal);

// Declared before /rules/:id so the literal paths are not read as ids.
router.get('/rules', validateQuery(listRulesSchema), discountController.listRules);
router.get('/resolve', validateQuery(resolveRuleSchema), discountController.resolveRule);
router.post('/evaluate', validate(evaluateSchema), discountController.evaluate);

router.get('/rules/:id', parseId(), discountController.getRule);

router.post('/rules', authorize('ADMIN'), validate(createRuleSchema), discountController.createRule);

router.patch(
  '/rules/:id',
  authorize('ADMIN'),
  parseId(),
  validate(updateRuleSchema),
  discountController.updateRule
);

router.delete('/rules/:id', authorize('ADMIN'), parseId(), discountController.deactivateRule);

export default router;
