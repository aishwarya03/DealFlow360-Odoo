import { Router } from 'express';

import { authenticatePortal } from '../../middleware/authenticate.js';
import parseId from '../../middleware/parseId.js';
import validate from '../../middleware/validate.js';
import * as portalController from './portal.controller.js';
import {
  createQuotationSchema,
  loginSchema,
  registerAndRequestSchema,
  registerSchema,
} from './portal.validator.js';

// Mounted at /api/portal by app.js.
//
// A genuinely separate surface from /api/internal, not a relabelled one: these
// routes authenticate against the PORTAL token audience, so an internal staff
// token fails signature verification here and a portal token fails there. Every
// response is built by a portal-specific serializer that never carries cost,
// margin, discount ceilings, approval state or risk scores.
const router = Router();

// Public — no token yet by definition.
router.post('/auth/register', validate(registerSchema), portalController.register);
router.post('/auth/login', validate(loginSchema), portalController.login);
router.post(
  '/quote-requests',
  validate(registerAndRequestSchema),
  portalController.registerAndRequest
);

// Everything below requires a signed-in customer.
router.use(authenticatePortal);

router.get('/auth/me', portalController.me);

router.get('/quotations', portalController.listQuotations);
router.get('/quotations/:id', parseId(), portalController.getQuotation);
router.post('/quotations', validate(createQuotationSchema), portalController.createQuotation);

export default router;
