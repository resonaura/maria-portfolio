import path from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(2978),
  HOST: z.string().default('0.0.0.0'),
  STORAGE_DIR: z.string().default(path.resolve(process.cwd(), 'storage')),
  CACHE_DIR: z.string().default(path.resolve(process.cwd(), '.cache')),
  CORS_ORIGIN: z.string().default('*')
});

export type AppConfig = z.infer<typeof envSchema> & {
  cacheFilesDir: string;
  dbPath: string;
};

export function validateEnv(raw: Record<string, unknown>): AppConfig {
  const parsed = envSchema.parse(raw);
  return {
    ...parsed,
    cacheFilesDir: path.join(parsed.CACHE_DIR, 'files'),
    dbPath: path.join(parsed.CACHE_DIR, 'index.sqlite')
  };
}
