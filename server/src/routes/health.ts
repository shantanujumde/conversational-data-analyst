import type { ApiResponse, Health } from '@cda/shared';
import { Router } from 'express';
import type { Db } from '../db/connection';
import { methodNotAllowed } from '../middleware/notFound';
import { getHealth } from '../services/healthService';

export function healthRouter(db: Db): Router {
  const router = Router();

  router
    .route('/health')
    .get((_req, res) => {
      const body: ApiResponse<Health> = { ok: true, data: getHealth(db) };
      res.set('Cache-Control', 'no-store').json(body);
    })
    .all(methodNotAllowed(['GET', 'HEAD']));

  return router;
}
