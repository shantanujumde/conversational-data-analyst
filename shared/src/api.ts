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

const EMPTY_QUESTION = 'Please type a question.';

/** A missing body, a non-object body and a non-string question all get the same message we wrote. */
export const AskRequestSchema = z.object(
  {
    question: z
      .string(EMPTY_QUESTION)
      .trim()
      .min(1, EMPTY_QUESTION)
      .max(QUESTION_MAX_LENGTH, `Questions can be up to ${QUESTION_MAX_LENGTH} characters.`),
  },
  EMPTY_QUESTION,
);
export type AskRequest = z.infer<typeof AskRequestSchema>;

/**
 * How a value is shown. `percent` values are fractions (0.342 → "34.2%"),
 * `currency` values are raw INR amounts.
 */
export const ValueFormatSchema = z.enum(['text', 'number', 'percent', 'currency']);
export type ValueFormat = z.infer<typeof ValueFormatSchema>;

/** Formats a metric can have: every value format except plain text. */
export const MetricFormatSchema = ValueFormatSchema.exclude(['text']);
export type MetricFormat = z.infer<typeof MetricFormatSchema>;

/** Which planner produced the answer: Gemini, OpenAI, or the keyword mock used in tests. */
export const AI_PROVIDERS = ['google', 'openai', 'mock'] as const;
export const AiProviderSchema = z.enum(AI_PROVIDERS);
export type AiProvider = z.infer<typeof AiProviderSchema>;

export const VisualizationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text') }),
  z.object({
    type: z.literal('kpi'),
    /** Metric id; `rows` has exactly one row. */
    valueKey: z.string(),
    format: MetricFormatSchema,
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

/** One result row, keyed by catalog id. */
export const RowSchema = z.record(z.string(), CellValueSchema);
export type Row = z.infer<typeof RowSchema>;

export const AskResultSchema = z.object({
  question: z.string(),
  title: z.string(),
  /** One sentence built from the rows by the server, never by the AI. */
  text: z.string(),
  visualization: VisualizationSchema,
  /** Dimension columns first, then metric columns. */
  columns: z.array(ColumnSchema),
  rows: z.array(RowSchema),
  /** Shown in the "How I got this" panel. */
  query: z.object({ dataset: z.string(), sql: z.string() }),
  meta: z.object({
    provider: AiProviderSchema,
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
