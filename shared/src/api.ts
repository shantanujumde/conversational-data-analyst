import { z } from 'zod';
import { type ErrorBody, ErrorBodySchema } from './errors';

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure<E = ErrorBody> = { ok: false; error: E };

/** The envelope every API response uses. */
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Runtime check for `ApiResponse<T>`, given the schema of `data`. */
export function ApiResponseSchema<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), data }),
    z.object({ ok: z.literal(false), error: ErrorBodySchema }),
  ]);
}
