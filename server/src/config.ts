import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type AiProvider, AiProviderSchema } from '@cda/shared';
import { z } from 'zod';

/** `server/`: relative paths in the env (like DATABASE_PATH) are resolved from here. */
const SERVER_ROOT = fileURLToPath(new URL('..', import.meta.url));

export const DEFAULT_DATABASE_PATH = './data/bank.db';

/** Absolute path of the SQLite file. A relative path is read from `server/`. */
export function resolveDatabasePath(value: string | undefined): string {
  return resolve(SERVER_ROOT, value || DEFAULT_DATABASE_PATH);
}

/** Model used when `AI_MODEL` is not set. */
export const DEFAULT_MODEL = {
  google: 'gemini-4-hydrogen',
  openai: 'gpt-5.4-mini',
  mock: 'keyword-rules',
} as const satisfies Record<AiProvider, string>;

/**
 * Which planner to use. A real provider always comes with its non-empty key, so the type
 * itself says no other code has to check for it.
 */
export type AiConfig = { AI_MODEL: string } & (
  | { AI_PROVIDER: 'google'; API_KEY: string }
  | { AI_PROVIDER: 'openai'; API_KEY: string }
  | { AI_PROVIDER: 'mock' }
);

/** The env variable that holds each real provider's key. */
const KEY_VARIABLE = { google: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY' } as const;

const EnvSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3001),
    CLIENT_ORIGIN: z.url().default('http://localhost:5173'),
    DATABASE_PATH: z.string().default(DEFAULT_DATABASE_PATH).transform(resolveDatabasePath),
    AI_PROVIDER: AiProviderSchema.default('google'),
    AI_MODEL: z.string().min(1).optional(),
    GEMINI_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    /** Questions allowed per minute per IP on `POST /api/v1/ask` (docs/SPEC.md §11). */
    ASK_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(20),
    NODE_ENV: z.string().optional(),
    /** Defaults to `silent` under tests, `info` otherwise. */
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
  })
  .transform((parsed, ctx) => {
    const { LOG_LEVEL, NODE_ENV, AI_PROVIDER, GEMINI_API_KEY, OPENAI_API_KEY, ...env } = parsed;
    const AI_MODEL = parsed.AI_MODEL ?? DEFAULT_MODEL[AI_PROVIDER];
    let ai: AiConfig;
    if (AI_PROVIDER === 'mock') {
      ai = { AI_PROVIDER, AI_MODEL };
    } else {
      const API_KEY = AI_PROVIDER === 'google' ? GEMINI_API_KEY : OPENAI_API_KEY;
      if (!API_KEY) {
        const variable = KEY_VARIABLE[AI_PROVIDER];
        ctx.addIssue({
          code: 'custom',
          path: [variable],
          message: `${variable} is required when AI_PROVIDER is ${AI_PROVIDER}`,
        });
        return z.NEVER;
      }
      ai = { AI_PROVIDER, AI_MODEL, API_KEY };
    }
    return {
      ...env,
      ...ai,
      LOG_LEVEL: LOG_LEVEL ?? (NODE_ENV === 'test' ? 'silent' : 'info'),
    };
  });

export type Config = z.infer<typeof EnvSchema>;

/** Thrown by `loadConfig`; the message names each wrong variable. */
export class ConfigError extends Error {
  override name = 'ConfigError';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // Treat `KEY=` (empty) the same as not set, so defaults apply.
  const cleaned = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [key, value?.trim() || undefined]),
  );
  const result = EnvSchema.safeParse(cleaned);
  if (!result.success) {
    throw new ConfigError(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
