import env from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';

// Anything a route or service throws lands here. Expected failures arrive as
// ApiError and carry their own status; everything else is a bug and becomes a 500.
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isUnexpected = !err.isOperational;

  if (isUnexpected) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  // Never leak an internal stack or driver message to the client in production.
  const message =
    isUnexpected && env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';

  return sendError(res, message, err.errors || [], statusCode);
};

export default errorHandler;
