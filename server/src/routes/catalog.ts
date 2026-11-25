import type { ApiResponse, CatalogResponse } from '@cda/shared';
import { Router } from 'express';
import { getCatalogSummary } from '../catalog/catalog';
import { methodNotAllowed } from '../middleware/notFound';

export function catalogRouter(): Router {
  const router = Router();

  router
    .route('/catalog')
    .get((_req, res) => {
      const body: ApiResponse<CatalogResponse> = { ok: true, data: getCatalogSummary() };
      res.json(body);
    })
    .all(methodNotAllowed(['GET', 'HEAD']));

  return router;
}
