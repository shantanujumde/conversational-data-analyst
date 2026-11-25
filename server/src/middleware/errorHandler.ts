import { randomUUID } from 'node:crypto';
import type { ApiFailure } from '@cda/shared';
import type { ErrorRequestHandler } from 'express';
import { toAppError } from '../errors';

/** The only place that writes an error response. */
export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  const appError = toAppError(err);
  // Placeholder until pino-http assigns request ids (docs/SPEC.md §10.2).
  const header = res.getHeader('X-Request-Id');
  const requestId = typeof header === 'string' ? header : randomUUID();
  res.set('X-Request-Id', requestId);
  if (appError.status >= 500) console.error(appError.cause ?? appError);

  const { suggestions, retryAfterSeconds } = appError.extra;
  const body: ApiFailure = {
    ok: false,
    error: {
      code: appError.code,
      message: appError.message,
      requestId,
      suggestions,
      retryAfterSeconds,
    },
  };
  res.status(appError.status).json(body);
};
