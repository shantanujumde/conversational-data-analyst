import express, { type Express } from 'express';
import type { Config } from './config';
import { errorHandler, notFound } from './middleware/errorHandler';
import { securityMiddleware } from './middleware/security';
import { healthRouter } from './routes/health';

export function createApp(config: Config): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(securityMiddleware(config));

  const v1 = express.Router();
  v1.use(healthRouter());
  app.use('/api/v1', v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
