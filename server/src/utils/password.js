import bcrypt from 'bcrypt';

// 10 rounds: the usual balance between resistance to offline cracking and a
// login that still returns quickly during a live demo.
const SALT_ROUNDS = 10;

export const hashPassword = (plainPassword) =>
  bcrypt.hash(plainPassword, SALT_ROUNDS);

export const verifyPassword = (plainPassword, passwordHash) =>
  bcrypt.compare(plainPassword, passwordHash);
