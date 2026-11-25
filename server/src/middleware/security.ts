import cors from 'cors';
import express, { type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type { Config } from '../config';
import { rateLimited } from '../errors';

/**
 * Security headers, CORS, and the JSON body parser with its 10 KB size limit.
 * The parser lives here because the size limit is the security control.
 */
export function securityMiddleware(config: Pick<Config, 'CLIENT_ORIGIN'>): RequestHandler[] {
  return [helmet(), cors({ origin: config.CLIENT_ORIGIN }), express.json({ limit: '10kb' })];
}

const MINUTE_MS = 60_000;

/** Per-IP limit for the ask endpoint (docs/SPEC.md §11). Over the limit → RATE_LIMITED through the error handler. */
export function askRateLimit(limitPerMinute: number): RequestHandler {
  return rateLimit({
    windowMs: MINUTE_MS,
    limit: limitPerMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(req, res, next) {
      const resetTime = (req as typeof req & { rateLimit?: { resetTime?: Date } }).rateLimit
        ?.resetTime;
      const msLeft = resetTime ? resetTime.getTime() - Date.now() : MINUTE_MS;
      const seconds = Math.max(1, Math.ceil(msLeft / 1000));
      res.set('Retry-After', String(seconds));
      next(rateLimited(seconds));
    },
  });
}
