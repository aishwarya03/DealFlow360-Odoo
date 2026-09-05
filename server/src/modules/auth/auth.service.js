import prisma from '../../prisma/client.js';
import ApiError from '../../utils/apiError.js';
import { AUDIENCE, signToken } from '../../utils/jwt.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';

// Every rule about who may log in and what a token carries lives here. The
// controller only translates HTTP to these calls and back.

// Never let a passwordHash leave this layer.
const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
});

const issueInternalToken = (user) =>
  signToken(
    {
      // "sub" must be a string per the JWT spec, so the numeric id is stringified
      // here and converted back in the authenticate middleware.
      sub: String(user.id),
      email: user.email,
      role: user.role,
    },
    AUDIENCE.INTERNAL
  );

export const registerUser = async ({ name, email, password, role }) => {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      role,
      passwordHash: await hashPassword(password),
    },
  });

  return { user: toPublicUser(user), token: issueInternalToken(user) };
};

export const loginUser = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });

  // Same error whether the email is unknown or the password is wrong, so the
  // endpoint cannot be used to enumerate which emails have accounts.
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  // Checked after the password so a deactivated account is not revealed to
  // someone who does not already hold its credentials.
  if (!user.isActive) {
    throw ApiError.forbidden('This account has been deactivated');
  }

  return { user: toPublicUser(user), token: issueInternalToken(user) };
};

// Resolves the token's subject against the database on every call, so a user
// deleted or deactivated since their token was issued stops being accepted
// without waiting for the token to expire.
export const getCurrentUser = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account no longer active');
  }

  return toPublicUser(user);
};
