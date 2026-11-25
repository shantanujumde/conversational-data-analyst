import express, { type Express } from 'express';
import type { Planner } from './ai/planner';
import type { Config } from './config';
import type { Db } from './db/connection';
import { createLogger, type Logger } from './logger';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { requestLogger } from './middleware/requestLogger';
import {
  ASK_RATE_LIMIT,
  askRateLimit,
  type RateLimitOptions,
  securityMiddleware,
} from './middleware/security';
import { askRouter } from './routes/ask';
import { catalogRouter } from './routes/catalog';
import { healthRouter } from './routes/health';

export interface AppDeps {
  config: Pick<Config, 'CLIENT_ORIGIN' | 'LOG_LEVEL'>;
  /** Read-only connection. */
  db: Db;
  planner: Planner;
  logger?: Logger;
  /** Limit for `POST /api/v1/ask`; defaults to 20 per minute per IP. `false` turns it off. */
  askRateLimit?: RateLimitOptions | false;
}

/** Builds the Express app without listening, so tests can drive it with supertest. */
export function createApp(deps: AppDeps): Express {
  const { config, db, planner } = deps;
  const logger = deps.logger ?? createLogger(config.LOG_LEVEL);
  const limits = deps.askRateLimit ?? ASK_RATE_LIMIT;

  const app = express();
  app.disable('x-powered-by');

  app.use(requestLogger(logger));
  app.use(securityMiddleware(config));

  const v1 = express.Router();
  v1.use(healthRouter(db));
  v1.use(catalogRouter());
  v1.use(askRouter({ db, planner, rateLimit: limits ? askRateLimit(limits) : undefined }));
  app.use('/api/v1', v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
