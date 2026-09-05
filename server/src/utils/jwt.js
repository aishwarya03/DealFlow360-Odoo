import jwt from 'jsonwebtoken';

import env from '../config/env.js';

const ISSUER = 'dealflow360';

// The security boundary the problem statement demands between the internal
// workspace and the customer portal. Both token families are signed with the
// same secret, but verification pins the audience, so a portal token presented
// to an internal route fails signature verification outright rather than
// relying on a role check somewhere downstream remembering to reject it.
export const AUDIENCE = {
  INTERNAL: 'dealflow360:internal',
  PORTAL: 'dealflow360:portal',
};

export const signToken = (payload, audience) =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
    audience,
    issuer: ISSUER,
  });

export const verifyToken = (token, audience) =>
  jwt.verify(token, env.JWT_SECRET, {
    audience,
    issuer: ISSUER,
  });
