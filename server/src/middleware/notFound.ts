import type { RequestHandler } from 'express';
import { AppError } from '../errors';

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new AppError('NOT_FOUND'));
};

/** For the end of a route: answers 405 with an `Allow` header listing the methods it supports. */
export function methodNotAllowed(allowed: string[]): RequestHandler {
  return (_req, res, next) => {
    res.set('Allow', allowed.join(', '));
    next(new AppError('METHOD_NOT_ALLOWED'));
  };
}
