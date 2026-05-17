import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1).optional(),
  MONGO_URI: z.string().min(1).optional(),
  MOGO_URI: z.string().min(1).optional(),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
  LOG_LEVEL: z.string().default('info'),
  QUEUE_NAME: z.string().default('media-processing'),
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const message = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment: ${message}`);
}

const mongoUri = parsed.data.MONGODB_URI || parsed.data.MONGO_URI || parsed.data.MOGO_URI;

if (!mongoUri && parsed.data.NODE_ENV !== 'test') {
  throw new Error('Missing MongoDB URI. Set MONGODB_URI in .env.');
}

export const env = {
  ...parsed.data,
  MONGODB_URI: mongoUri || 'mongodb://127.0.0.1:27017/media_pipeline_test',
  MAX_UPLOAD_BYTES: Math.floor(parsed.data.MAX_UPLOAD_MB * 1024 * 1024),
};
