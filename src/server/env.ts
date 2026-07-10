import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().default('dev-secret-change-in-production'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_NAME: z.string().default('concentrate-quiz'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  // Controls the `Secure` flag on session cookies. Defaults to NODE_ENV === 'production',
  // but can be forced to 'false' for deployments served over plain HTTP without TLS.
  SECURE_COOKIES: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === undefined ? undefined : v === 'true'),
});

const envVars = {
  NODE_ENV: process.env.NODE_ENV,
  JWT_SECRET: process.env.JWT_SECRET,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
  DB_NAME: process.env.DB_NAME,
  REDIS_URL: process.env.REDIS_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  SECURE_COOKIES: process.env.SECURE_COOKIES,
};

const result = envSchema.safeParse(envVars);

if (!result.success) {
  const missing = Object.entries(result.error.flatten().fieldErrors)
    .map(([key, errors]) => `${key}: ${errors.join(', ')}`)
    .join('\n  ');
  console.error('Invalid environment variables:\n  ' + missing);

  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

const parsedEnv = result.data ?? envSchema.parse(envVars);

export const env = {
  ...parsedEnv,
  SECURE_COOKIES: parsedEnv.SECURE_COOKIES ?? parsedEnv.NODE_ENV === 'production',
};
