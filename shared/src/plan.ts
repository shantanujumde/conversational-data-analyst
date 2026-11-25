import { z } from 'zod';

/** Datasets the AI may pick from. The server catalog defines what each one contains. */
export const DATASET_IDS = ['applications', 'transactions', 'customers'] as const;
export const DatasetIdSchema = z.enum(DATASET_IDS);
export type DatasetId = z.infer<typeof DatasetIdSchema>;

const IsoDate = z.iso.date(); // YYYY-MM-DD

/** Most rows a plan may ask for. buildQuery also caps LIMIT at this. */
export const PLAN_LIMIT_MAX = 100;
/** Longest answer title. */
export const PLAN_TITLE_MAX = 80;

export const QueryPlanFilterSchema = z.object({
  dimension: z.string(),
  values: z.array(z.string()).min(1).max(20),
});

/** A question the catalog can answer. Metric and dimension ids are checked against the catalog on the server. */
export const QueryPlanQuerySchema = z.object({
  kind: z.literal('query'),
  dataset: DatasetIdSchema,
  metrics: z.array(z.string()).min(1).max(3),
  groupBy: z.array(z.string()).max(2),
  filters: z.array(QueryPlanFilterSchema).max(5),
  dateRange: z.object({ from: IsoDate, to: IsoDate }).optional(),
  sort: z.object({ by: z.string(), direction: z.enum(['asc', 'desc']) }).optional(),
  limit: z.int().min(1).max(PLAN_LIMIT_MAX).optional(),
  title: z.string().min(1).max(PLAN_TITLE_MAX),
});

export const QueryPlanUnsupportedSchema = z.object({
  kind: z.literal('unsupported'),
  reason: z.string(),
});

/** The AI's only output. It never contains SQL (docs/SPEC.md §6). */
export const QueryPlanSchema = z.discriminatedUnion('kind', [
  QueryPlanQuerySchema,
  QueryPlanUnsupportedSchema,
]);
export type QueryPlan = z.infer<typeof QueryPlanSchema>;
export type QueryPlanQuery = z.infer<typeof QueryPlanQuerySchema>;
