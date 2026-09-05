import { z } from 'zod';

const ROLES = ['ADMIN', 'SALES_REP', 'SALES_MANAGER', 'FINANCE'];

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().toLowerCase().email('Must be a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  // Open at signup so every role needed for the demo can be created without a
  // bootstrap admin. In production this field would be rejected here and role
  // assignment restricted to an admin-only endpoint.
  role: z.enum(ROLES).default('SALES_REP'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
