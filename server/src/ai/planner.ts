import { type AiProvider, type QueryPlanQuery, QueryPlanSchema } from '@cda/shared';
import { APICallError, generateText, type LanguageModel, Output } from 'ai';
import { AppError } from '../errors';
import { unsupportedQuestion } from '../query/unsupported';
import { buildSystemPrompt, buildUserPrompt } from './prompt';

/** Time allowed for one model call. Free-tier Gemini often needs 15–20 s. */
export const AI_TIMEOUT_MS = 30_000;
/** One automatic retry when the provider is busy (timeout, 429, 5xx). */
export const AI_MAX_ATTEMPTS = 2;

/**
 * Turns a question into a query plan. Tests inject their own.
 * A question the catalog can't answer throws UNSUPPORTED_QUESTION (`unsupportedQuestion`).
 */
export interface Planner {
  readonly provider: AiProvider;
  readonly model: string;
  plan(question: string): Promise<QueryPlanQuery>;
}

/** True for failures worth one more try: our timeout, or a provider status the SDK marks retryable (429, 5xx). */
export function isRetryable(err: unknown): boolean {
  if (err instanceof DOMException) return err.name === 'TimeoutError' || err.name === 'AbortError';
  return APICallError.isInstance(err) && err.isRetryable;
}

/** Plans with a real model through the AI SDK: up to 2 attempts, 30 s each. */
export function createAiPlanner(model: LanguageModel, modelId: string): Planner {
  return {
    provider: 'google',
    model: modelId,
    async plan(question) {
      const call = async () => {
        const result = await generateText({
          model,
          instructions: buildSystemPrompt(new Date()),
          prompt: buildUserPrompt(question),
          output: Output.object({ schema: QueryPlanSchema, name: 'query_plan' }),
          providerOptions: { google: { thinkingConfig: { thinkingLevel: 'low' } } },
          abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
          maxRetries: 0, // retries are handled below, so the timeout covers each attempt
        });
        return result.output as unknown;
      };

      let output: unknown;
      for (let attempt = 1; ; attempt++) {
        try {
          output = await call();
          break;
        } catch (err) {
          if (attempt < AI_MAX_ATTEMPTS && isRetryable(err)) continue;
          throw new AppError('AI_ERROR', undefined, {}, { cause: err });
        }
      }

      // The SDK already checked the shape; check again so nothing unparsed reaches the query layer.
      const parsed = QueryPlanSchema.safeParse(output);
      if (!parsed.success) {
        throw new AppError('AI_ERROR', undefined, {}, { cause: parsed.error });
      }
      if (parsed.data.kind === 'unsupported') {
        throw unsupportedQuestion(`AI marked the question unsupported: ${parsed.data.reason}`);
      }
      return parsed.data;
    },
  };
}
