import { Router } from 'express';

import { authenticateInternal } from '../../middleware/authenticate.js';
import authorize from '../../middleware/authorize.js';
import validate from '../../middleware/validate.js';
import * as authController from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.validator.js';

// Mounted at /api/internal/auth by app.js.
const router = Router();

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.get('/me', authenticateInternal, authController.me);

// Exists to prove the role gate works end to end from Postman before any
// feature depends on it. Replaced by real admin routes in the next slice.
router.get(
  '/admin-only',
  authenticateInternal,
  authorize('ADMIN'),
  (req, res) => {
    res.json({
      success: true,
      message: `Role gate passed. Welcome, ${req.user.email}.`,
      data: null,
    });
  }
);

export default router;
