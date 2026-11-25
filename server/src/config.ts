import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/** `server/`: relative paths in the env (like DATABASE_PATH) are resolved from here. */
const SERVER_ROOT = fileURLToPath(new URL('..', import.meta.url));

export const DEFAULT_DATABASE_PATH = './data/bank.db';

/** Absolute path of the SQLite file. A relative path is read from `server/`. */
export function resolveDatabasePath(value: string | undefined): string {
  return resolve(SERVER_ROOT, value || DEFAULT_DATABASE_PATH);
}

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_ORIGIN: z.url().default('http://localhost:5173'),
});

export type Config = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
