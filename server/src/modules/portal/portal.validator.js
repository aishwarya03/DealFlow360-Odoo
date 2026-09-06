import { z } from 'zod';

const lineSchema = z
  .object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive('Quantity must be at least 1'),
    isRecurring: z.boolean().default(false),
    recurringCycle: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  })
  .refine((data) => !data.isRecurring || data.recurringCycle, {
    message: 'recurringCycle is required when isRecurring is true',
    path: ['recurringCycle'],
  });

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your name').max(120),
  company: z.string().trim().min(2, 'Please enter your company name').max(160),
  email: z.string().trim().toLowerCase().email('Must be a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().trim().min(5).max(30).optional(),
  address: z.string().trim().min(1, 'Please enter your address').max(500).optional(),
  pincode: z.string().trim().min(1, 'Please enter your pincode').max(20).optional(),
  state: z.string().trim().min(1, 'Please enter your state').max(100).optional(),
  country: z.string().trim().min(1, 'Please enter your country').max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Signup and first quotation in one submission — the public "Request a Quote"
// form. Everything is created together or not at all.
export const registerAndRequestSchema = registerSchema.extend({
  message: z.string().trim().max(2000).optional(),
  lines: z.array(lineSchema).min(1, 'Your cart is empty'),
});

export const createQuotationSchema = z.object({
  message: z.string().trim().max(2000).optional(),
  lines: z.array(lineSchema).min(1, 'At least one line is required'),
});
