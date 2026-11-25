import {
  DatasetIdSchema,
  PLAN_LIMIT_MAX,
  PLAN_TITLE_MAX,
  QueryPlanFilterSchema,
} from '@cda/shared';
import { z } from 'zod';

/**
 * The plan shape the model is asked to fill. Providers' strict JSON modes reject a
 * `query | unsupported` union (OpenAI: "'oneOf' is not permitted") and optional fields,
 * so the model gets one flat object where every field is present and unused ones are null.
 * `toQueryPlanInput` turns it back into the strict union, which the planner then checks
 * with `QueryPlanSchema` as before (docs/SPEC.md §7).
 */
export const AiPlanSchema = z.object({
  kind: z.enum(['query', 'unsupported']),
  reason: z.string().nullable().describe('Only for unsupported: why the data cannot answer it'),
  dataset: DatasetIdSchema.nullable(),
  metrics: z.array(z.string()),
  groupBy: z.array(z.string()),
  filters: z.array(QueryPlanFilterSchema),
  dateRange: z
    .object({
      from: z.string().describe('YYYY-MM-DD'),
      to: z.string().describe('YYYY-MM-DD'),
    })
    .nullable(),
  sort: z.object({ by: z.string(), direction: z.enum(['asc', 'desc']) }).nullable(),
  limit: z.number().nullable(),
  title: z.string().nullable(),
});
export type AiPlan = z.infer<typeof AiPlanSchema>;

/**
 * Fits the model's limit into 1..PLAN_LIMIT_MAX. A fraction is cut to a whole number;
 * zero, negative or non-finite means "no limit given", so buildQuery's default applies.
 */
function fitLimit(limit: number | null): number | undefined {
  if (limit === null || !Number.isFinite(limit)) return undefined;
  const whole = Math.trunc(limit);
  return whole < 1 ? undefined : Math.min(whole, PLAN_LIMIT_MAX);
}

/** Uses the model's title, or the question when it gave none, cut to PLAN_TITLE_MAX characters. */
function fitTitle(title: string | null, question: string): string {
  const text = title?.trim() || question.trim() || 'Answer';
  return text.length <= PLAN_TITLE_MAX ? text : `${text.slice(0, PLAN_TITLE_MAX - 1).trimEnd()}…`;
}

/**
 * Rebuilds the strict-union shape from the flat one. Nulls become absent fields.
 * Limit and title are fitted here rather than rejected: a model that asks for 150 rows
 * or writes a long title still produced a usable plan, and refusing it would fail the same way on retry.
 */
export function toQueryPlanInput(plan: AiPlan, question = ''): unknown {
  if (plan.kind === 'unsupported') {
    return { kind: 'unsupported', reason: plan.reason ?? 'no reason given' };
  }
  const { reason: _reason, dateRange, sort, limit, title, ...query } = plan;
  const fittedLimit = fitLimit(limit);
  return {
    ...query,
    title: fitTitle(title, question),
    ...(dateRange ? { dateRange } : {}),
    ...(sort ? { sort } : {}),
    ...(fittedLimit !== undefined ? { limit: fittedLimit } : {}),
  };
}
