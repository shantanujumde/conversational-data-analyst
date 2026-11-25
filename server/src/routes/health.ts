import type { ApiResponse, Health } from '@cda/shared';
import { Router } from 'express';
import pkg from '../../package.json' with { type: 'json' };
import { type Db, isDatabaseReachable } from '../db/connection';
import { methodNotAllowed } from '../middleware/notFound';

export function healthRouter(db: Db): Router {
  const router = Router();

  router
    .route('/health')
    .get((_req, res) => {
      const body: ApiResponse<Health> = {
        ok: true,
        data: {
          status: isDatabaseReachable(db) ? 'ok' : 'degraded',
          service: 'cda-server',
          version: pkg.version,
          uptimeSeconds: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
        },
      };
      res.set('Cache-Control', 'no-store').json(body);
    })
    .all(methodNotAllowed(['GET', 'HEAD']));

  return router;
}
