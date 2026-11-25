import { type QueryPlan, QueryPlanSchema } from '@cda/shared';
import { generateText, type LanguageModel, Output } from 'ai';
import { SUGGESTIONS } from '../catalog/examples';
import { AppError } from '../errors';
import { buildSystemPrompt, buildUserPrompt } from './prompt';

export const AI_TIMEOUT_MS = 15_000;

/** Turns a question into a query plan. Tests inject their own. */
export interface Planner {
  readonly provider: 'google' | 'mock';
  readonly model: string;
  plan(question: string): Promise<QueryPlan>;
}

/** The error for a question the catalog can't answer. The reason is logged, not shown. */
export function unsupportedQuestion(reason: string): AppError {
  return new AppError(
    'UNSUPPORTED_QUESTION',
    undefined,
    { suggestions: [...SUGGESTIONS] },
    { cause: new Error(`AI marked the question unsupported: ${reason}`) },
  );
}

/** Plans with a real model through the AI SDK: one call, no retries, 15 s timeout. */
export function createAiPlanner(model: LanguageModel, modelId: string): Planner {
  return {
    provider: 'google',
    model: modelId,
    async plan(question) {
      let output: unknown;
      try {
        const result = await generateText({
          model,
          instructions: buildSystemPrompt(new Date()),
          prompt: buildUserPrompt(question),
          output: Output.object({ schema: QueryPlanSchema, name: 'query_plan' }),
          providerOptions: { google: { thinkingConfig: { thinkingLevel: 'low' } } },
          abortSignal: AbortSignal.timeout(AI_TIMEOUT_MS),
          maxRetries: 0,
        });
        output = result.output;
      } catch (err) {
        throw new AppError('AI_ERROR', undefined, {}, { cause: err });
      }

      // The SDK already checked the shape; check again so nothing unparsed reaches the query layer.
      const parsed = QueryPlanSchema.safeParse(output);
      if (!parsed.success) {
        throw new AppError('AI_ERROR', undefined, {}, { cause: parsed.error });
      }
      if (parsed.data.kind === 'unsupported') throw unsupportedQuestion(parsed.data.reason);
      return parsed.data;
    },
  };
}
