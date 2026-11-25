import { type ApiResponse, type AskResult, AskRequestSchema } from '@cda/shared';
import { type RequestHandler, Router } from 'express';
import type { Planner } from '../ai/planner';
import type { Db } from '../db/connection';
import { AppError } from '../errors';
import { methodNotAllowed } from '../middleware/notFound';
import { askQuestion } from '../services/askService';

export function askRouter(deps: { db: Db; planner: Planner; rateLimit?: RequestHandler }): Router {
  const router = Router();
  const limit: RequestHandler[] = deps.rateLimit ? [deps.rateLimit] : [];

  router
    .route('/ask')
    .post(...limit, async (req, res) => {
      const parsed = AskRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message);
      }
      const { question } = parsed.data;
      req.log.info({ question }, 'Question received');

      const data = await askQuestion(question, {
        db: deps.db,
        planner: deps.planner,
        log: req.log,
      });
      const body: ApiResponse<AskResult> = { ok: true, data };
      res.json(body);
    })
    .all(methodNotAllowed(['POST']));

  return router;
}
