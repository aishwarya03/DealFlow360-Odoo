import dotenv from 'dotenv';
import { z } from 'zod';

// Loaded here, at the top of the import graph, so that any module reading env at
// import time (the Prisma client, for one) sees a populated process.env.
dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'is required (pooled Neon connection string)'),
  DIRECT_URL: z.string().min(1, 'is required (unpooled Neon string, used by migrations)'),
  JWT_SECRET: z.string().min(16, 'must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
});

const parsed = envSchema.safeParse(process.env);

// Fail at boot with a readable message rather than at the first request with an
// undefined connection string.
if (!parsed.success) {
  console.error('\nInvalid environment configuration in server/.env:\n');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')} ${issue.message}`);
  }
  console.error('\nSee server/.env.example for the expected keys.\n');
  process.exit(1);
}

const env = parsed.data;

export default env;
