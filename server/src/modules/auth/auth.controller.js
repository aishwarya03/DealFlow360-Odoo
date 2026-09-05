import { sendSuccess } from '../../utils/apiResponse.js';
import * as authService from './auth.service.js';

// Thin by design: no business rules here, only HTTP in and HTTP out.
// Express 5 forwards a rejected promise to the error handler on its own,
// so these need no try/catch.

export const register = async (req, res) => {
  const { user, token } = await authService.registerUser(req.body);

  sendSuccess(res, 'Account created', { user, token }, 201);
};

export const login = async (req, res) => {
  const { user, token } = await authService.loginUser(req.body);

  sendSuccess(res, 'Logged in', { user, token });
};

export const me = async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);

  sendSuccess(res, 'Current user', { user });
};
