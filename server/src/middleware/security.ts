import cors from 'cors';
import express, { type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type { Config } from '../config';
import { AppError } from '../errors';

/**
 * Security headers, CORS, and the JSON body parser with its 10 KB size limit.
 * The parser lives here because the size limit is the security control.
 */
export function securityMiddleware(config: Pick<Config, 'CLIENT_ORIGIN'>): RequestHandler[] {
  return [helmet(), cors({ origin: config.CLIENT_ORIGIN }), express.json({ limit: '10kb' })];
}

export interface RateLimitOptions {
  windowMs: number;
  /** Requests allowed per IP per window. */
  limit: number;
}

/** 20 questions per minute per IP (docs/SPEC.md §11). */
export const ASK_RATE_LIMIT: RateLimitOptions = { windowMs: 60_000, limit: 20 };

/** Per-IP limit for the ask endpoint. Over the limit → RATE_LIMITED through the error handler. */
export function askRateLimit({ windowMs, limit }: RateLimitOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler(req, res, next) {
      const resetTime = (req as typeof req & { rateLimit?: { resetTime?: Date } }).rateLimit
        ?.resetTime;
      const msLeft = resetTime ? resetTime.getTime() - Date.now() : windowMs;
      const seconds = Math.max(1, Math.ceil(msLeft / 1000));
      res.set('Retry-After', String(seconds));
      next(
        new AppError(
          'RATE_LIMITED',
          `Too many questions at once. Try again in ${seconds} seconds.`,
          {
            retryAfterSeconds: seconds,
          },
        ),
      );
    },
  });
}
