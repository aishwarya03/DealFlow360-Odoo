import ApiError from '../utils/apiError.js';
import { AUDIENCE, verifyToken } from '../utils/jwt.js';

// Verifies a Bearer token against a specific audience and attaches the caller
// to req.user. Audience is a required argument rather than a default, so a new
// route tree cannot silently inherit the internal boundary by omission.
const authenticate = (audience) => (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(ApiError.unauthorized('No token provided'));
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const decoded = verifyToken(token, audience);

    req.user = {
      // Back to a number: the token carries it as a string, but every Prisma
      // lookup expects the Int primary key.
      id: Number(decoded.sub),
      email: decoded.email,
      role: decoded.role,
      audience: decoded.aud,
    };

    return next();
  } catch {
    // Covers expired, tampered, and wrong-audience tokens alike. The reason is
    // deliberately not echoed back: it tells an attacker which part they got right.
    return next(ApiError.unauthorized('Invalid or expired token'));
  }
};

export const authenticateInternal = authenticate(AUDIENCE.INTERNAL);
export const authenticatePortal = authenticate(AUDIENCE.PORTAL);

export default authenticate;
