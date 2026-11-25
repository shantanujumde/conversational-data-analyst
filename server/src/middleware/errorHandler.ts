import type { ApiFailure } from '@cda/shared';
import type { ErrorRequestHandler } from 'express';
import { toAppError } from '../errors';

/** The only place that writes an error response. */
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  const appError = toAppError(err);
  if (appError.status >= 500) console.error(appError.cause ?? appError);

  const { suggestions, retryAfterSeconds } = appError.extra;
  const body: ApiFailure = {
    ok: false,
    error: { code: appError.code, message: appError.message, suggestions, retryAfterSeconds },
  };
  res.status(appError.status).json(body);
};
