import type { ApiResponse, CatalogResponse } from '@cda/shared';
import { Router } from 'express';
import { methodNotAllowed } from '../middleware/notFound';
import { getCatalog } from '../services/catalogService';

export function catalogRouter(): Router {
  const router = Router();

  router
    .route('/catalog')
    .get((_req, res) => {
      const body: ApiResponse<CatalogResponse> = { ok: true, data: getCatalog() };
      res.json(body);
    })
    .all(methodNotAllowed(['GET', 'HEAD']));

  return router;
}
