import cors from 'cors';
import express, { type RequestHandler } from 'express';
import helmet from 'helmet';
import type { Config } from '../config';

export function securityMiddleware(config: Config): RequestHandler[] {
  return [helmet(), cors({ origin: config.CLIENT_ORIGIN }), express.json({ limit: '10kb' })];
}
