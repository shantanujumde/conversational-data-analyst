import type { ApiResponse, Health } from '@cda/shared';
import { Router } from 'express';
import pkg from '../../package.json' with { type: 'json' };
import { methodNotAllowed } from '../middleware/errorHandler';

export function healthRouter(): Router {
  const router = Router();

  router
    .route('/health')
    .get((_req, res) => {
      const body: ApiResponse<Health> = {
        ok: true,
        data: {
          status: 'ok',
          service: 'cda-server',
          version: pkg.version,
          uptimeSeconds: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
        },
      };
      res.set('Cache-Control', 'no-store').json(body);
    })
    .all(methodNotAllowed(['GET']));

  return router;
}
