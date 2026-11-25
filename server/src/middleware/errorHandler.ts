import type { ApiResponse } from '@cda/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../errors';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError('NOT_FOUND', 404, `No route for ${req.method} ${req.path}.`));
};

/** Answers 405 with an `Allow` header listing the methods the route does support. */
export function methodNotAllowed(allowed: string[]): RequestHandler {
  return (req, res, next) => {
    res.set('Allow', allowed.join(', '));
    next(
      new AppError(
        'METHOD_NOT_ALLOWED',
        405,
        `${req.method} is not allowed on ${req.baseUrl}${req.path}.`,
      ),
    );
  };
}

/** Body-parser errors carry a `type` and an HTTP `status`. */
function isBodyParserError(err: unknown): err is { type: string; status: number } {
  return typeof err === 'object' && err !== null && 'type' in err && 'status' in err;
}

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  let appError: AppError;
  if (err instanceof AppError) {
    appError = err;
  } else if (isBodyParserError(err) && err.type === 'entity.parse.failed') {
    appError = new AppError('VALIDATION_ERROR', 400, 'Request body is not valid JSON.');
  } else if (isBodyParserError(err) && err.type === 'entity.too.large') {
    appError = new AppError('VALIDATION_ERROR', 413, 'Request body is too large.');
  } else {
    console.error(err);
    appError = new AppError('INTERNAL_ERROR', 500, 'Something went wrong on our side.');
  }

  const body: ApiResponse<never> = {
    ok: false,
    error: { code: appError.code, message: appError.message },
  };
  res.status(appError.status).json(body);
};
