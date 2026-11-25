import type { ApiFailure } from '@cda/shared';
import type { ErrorRequestHandler } from 'express';
import { toAppError } from '../errors';

/** The only place that writes an error response. Logs once, sends only safe fields. */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  const appError = toAppError(err);
  // requestLogger already set req.id (always a string) and the X-Request-Id header.
  const requestId = req.id as string;

  const { cause } = appError;
  if (appError.status >= 500) {
    req.log.error({ code: appError.code, err: appError, cause }, appError.message);
  } else {
    // 4xx: no stack. The cause's message says which rule failed (e.g. why a plan was rejected).
    const reason = cause instanceof Error ? cause.message : undefined;
    req.log.warn({ code: appError.code, status: appError.status, reason }, appError.message);
  }

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
