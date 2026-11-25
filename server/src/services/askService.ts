import type { AskResult } from '@cda/shared';
import { unsupportedQuestion, type Planner } from '../ai/planner';
import { chooseVisualization } from '../answer/chooseVisualization';
import { summarize } from '../answer/summarize';
import type { Db } from '../db/connection';
import type { Logger } from '../logger';
import { buildQuery } from '../query/buildQuery';
import { runQuery } from '../query/runQuery';
import { validatePlan } from '../query/validatePlan';

export interface AskDeps {
  db: Db;
  planner: Planner;
  log: Logger;
}

/** question → plan → validate → build → run → answer. Errors are thrown as AppError. */
export async function askQuestion(
  question: string,
  { db, planner, log }: AskDeps,
): Promise<AskResult> {
  const started = performance.now();

  const plan = await planner.plan(question);
  if (plan.kind === 'unsupported') throw unsupportedQuestion(plan.reason);
  log.info({ plan }, 'Planned question');

  const validated = validatePlan(plan);
  const query = buildQuery(validated);
  const rawRows = runQuery(db, query);
  const shaped = chooseVisualization(validated, rawRows);
  const durationMs = Math.round(performance.now() - started);
  // Row count only: full rows are never logged.
  log.info(
    { rowCount: shaped.rows.length, visual: shaped.visualization.type, durationMs },
    'Answered',
  );

  return {
    question,
    title: validated.plan.title,
    text: summarize(validated, shaped),
    visualization: shaped.visualization,
    columns: shaped.columns,
    rows: shaped.rows,
    query: { dataset: validated.plan.dataset, sql: query.sql },
    meta: { provider: planner.provider, model: planner.model, durationMs },
  };
}
