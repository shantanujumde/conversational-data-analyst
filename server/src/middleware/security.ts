import cors from 'cors';
import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import type { Config } from '../config';

/**
 * Security headers, CORS, and the JSON body parser with its 10 KB size limit.
 * The parser lives here because the size limit is the security control.
 */
export function securityMiddleware(config: Config): RequestHandler[] {
  return [helmet(), cors({ origin: config.CLIENT_ORIGIN }), express.json({ limit: '10kb' })];
}
