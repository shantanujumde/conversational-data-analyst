import { z } from 'zod';
import { type ErrorBody, ErrorBodySchema } from './errors';
import { DatasetIdSchema } from './plan';

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure<E = ErrorBody> = { ok: false; error: E };

/** The envelope every API response uses. */
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Runtime check for `ApiResponse<T>`, given the schema of `data`. */
export function ApiResponseSchema<T extends z.ZodType>(data: T) {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), data }),
    z.object({ ok: z.literal(false), error: ErrorBodySchema }),
  ]);
}

// ---- POST /api/v1/ask ----

export const QUESTION_MAX_LENGTH = 500;

export const AskRequestSchema = z.object({
  question: z
    .string('Please type a question.')
    .trim()
    .min(1, 'Please type a question.')
    .max(QUESTION_MAX_LENGTH, 'Questions can be up to 500 characters.'),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

/**
 * How a value is shown. `percent` values are fractions (0.342 → "34.2%"),
 * `currency` values are raw INR amounts.
 */
export const ValueFormatSchema = z.enum(['text', 'number', 'percent', 'currency']);
export type ValueFormat = z.infer<typeof ValueFormatSchema>;

export const VisualizationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text') }),
  z.object({
    type: z.literal('kpi'),
    /** Metric id; `rows` has exactly one row. */
    valueKey: z.string(),
    format: ValueFormatSchema.exclude(['text']),
  }),
  z.object({ type: z.literal('table') }),
  z.object({
    type: z.enum(['bar', 'line']),
    /** Dimension id on the x axis (`month` for line charts). */
    x: z.string(),
    /** Metric id on the y axis. */
    y: z.string(),
    /** Optional second dimension id. Rows are long format; the client pivots them. */
    series: z.string().optional(),
  }),
]);
export type Visualization = z.infer<typeof VisualizationSchema>;

export const ColumnSchema = z.object({
  key: z.string(),
  label: z.string(),
  format: ValueFormatSchema,
});
export type Column = z.infer<typeof ColumnSchema>;

export const CellValueSchema = z.union([z.string(), z.number(), z.null()]);
export type CellValue = z.infer<typeof CellValueSchema>;

export const AskResultSchema = z.object({
  question: z.string(),
  title: z.string(),
  /** One sentence built from the rows by the server, never by the AI. */
  text: z.string(),
  visualization: VisualizationSchema,
  /** Dimension columns first, then metric columns. */
  columns: z.array(ColumnSchema),
  rows: z.array(z.record(z.string(), CellValueSchema)),
  /** Shown in the "How I got this" panel. */
  query: z.object({ dataset: z.string(), sql: z.string() }),
  meta: z.object({
    provider: z.enum(['google', 'mock']),
    model: z.string(),
    durationMs: z.number().nonnegative(),
  }),
});
export type AskResult = z.infer<typeof AskResultSchema>;

// ---- GET /api/v1/catalog ----

export const CatalogResponseSchema = z.object({
  datasets: z.array(z.object({ id: DatasetIdSchema, label: z.string(), description: z.string() })),
  /** Example questions for the empty state and refusal suggestions. */
  examples: z.array(z.string()).min(1),
});
export type CatalogResponse = z.infer<typeof CatalogResponseSchema>;
