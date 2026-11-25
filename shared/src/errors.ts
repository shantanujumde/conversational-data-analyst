import { z } from 'zod';

/** Error codes the server can send. The client adds its own in `client/src/api/client.ts`. */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNSUPPORTED_QUESTION',
  'AI_ERROR',
  'QUERY_ERROR',
  'RATE_LIMITED',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'INTERNAL_ERROR',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorBodySchema = z.object({
  code: ErrorCodeSchema,
  /** Safe to show the user; always written by the server. */
  message: z.string(),
  /** Same value as the X-Request-Id response header. */
  requestId: z.string(),
  suggestions: z.array(z.string()).optional(),
  retryAfterSeconds: z.number().int().positive().optional(),
});
export type ErrorBody = z.infer<typeof ErrorBodySchema>;
