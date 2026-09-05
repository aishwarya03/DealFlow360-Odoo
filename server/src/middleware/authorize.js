import ApiError from '../utils/apiError.js';

// Role gate. Runs after authenticate, which has already put the caller on req.user.
// Usage: router.get('/x', authenticateInternal, authorize('ADMIN'), handler)
const authorize =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Not authenticated'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Requires one of: ${allowedRoles.join(', ')}. You are ${req.user.role}.`
        )
      );
    }

    return next();
  };

export default authorize;
