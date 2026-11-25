import { z } from 'zod';

export const ErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'UNSUPPORTED_QUESTION',
  'AI_ERROR',
  'QUERY_ERROR',
  'RATE_LIMITED',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  suggestions: z.array(z.string()).optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** Builds the Zod schema for an `ApiResponse<T>` envelope around a data schema. */
export function apiResponseSchema<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), data }),
    z.object({ ok: z.literal(false), error: ApiErrorSchema }),
  ]);
}
