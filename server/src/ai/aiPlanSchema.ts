import { DatasetIdSchema, QueryPlanFilterSchema } from '@cda/shared';
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

/** Rebuilds the strict-union shape from the flat one. Nulls become absent fields. */
export function toQueryPlanInput(plan: AiPlan): unknown {
  if (plan.kind === 'unsupported') {
    return { kind: 'unsupported', reason: plan.reason ?? 'no reason given' };
  }
  const { reason: _reason, dateRange, sort, limit, ...query } = plan;
  return {
    ...query,
    ...(dateRange ? { dateRange } : {}),
    ...(sort ? { sort } : {}),
    ...(limit !== null ? { limit } : {}),
  };
}
