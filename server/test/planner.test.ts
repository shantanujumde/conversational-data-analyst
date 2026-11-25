import type { QueryPlan } from '@cda/shared';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { createMockPlanner } from '../src/ai/mockPlanner';
import { createAiPlanner } from '../src/ai/planner';
import { EXAMPLE_QUESTIONS } from '../src/catalog/examples';
import { loadConfig } from '../src/config';
import { validatePlan } from '../src/query/validatePlan';

function modelReturning(text: string) {
  return new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text }],
      finishReason: { unified: 'stop', raw: 'STOP' },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 10, text: 10, reasoning: 0 },
      },
      warnings: [],
    },
  });
}

const rejectionPlan: QueryPlan = {
  kind: 'query',
  dataset: 'applications',
  metrics: ['rejection_rate'],
  groupBy: ['branch'],
  filters: [],
  sort: { by: 'rejection_rate', direction: 'desc' },
  limit: 10,
  title: 'Rejection rate by branch',
};

describe('AI planner', () => {
  it('returns the parsed plan and keeps the question out of the system prompt', async () => {
    const model = modelReturning(JSON.stringify(rejectionPlan));
    const planner = createAiPlanner(model, 'test-model');

    await expect(planner.plan('Which branches have the highest rejection rate?')).resolves.toEqual(
      rejectionPlan,
    );
    const call = model.doGenerateCalls[0];
    const system = call?.prompt.find((m) => m.role === 'system');
    const user = call?.prompt.find((m) => m.role === 'user');
    expect(system?.content).toContain('rejection_rate');
    expect(system?.content).not.toContain('Which branches');
    expect(JSON.stringify(user?.content)).toContain(
      '<question>Which branches have the highest rejection rate?</question>',
    );
  });

  it('turns an unsupported plan into UNSUPPORTED_QUESTION with 3 suggestions', async () => {
    const planner = createAiPlanner(
      modelReturning(JSON.stringify({ kind: 'unsupported', reason: 'weather' })),
      'test-model',
    );

    await expect(planner.plan('Weather in Mumbai?')).rejects.toMatchObject({
      code: 'UNSUPPORTED_QUESTION',
      extra: { suggestions: expect.any(Array) as unknown },
    });
  });

  it.each([
    ['output that is not JSON', 'Sure! Here is your plan.'],
    ['output that fails the schema', JSON.stringify({ kind: 'query', dataset: 'loans' })],
  ])('turns %s into AI_ERROR', async (_case, text) => {
    const planner = createAiPlanner(modelReturning(text), 'test-model');

    await expect(planner.plan('Anything')).rejects.toMatchObject({ code: 'AI_ERROR' });
  });

  it('turns a provider error into AI_ERROR and keeps the original as cause', async () => {
    const providerError = new Error('upstream 503 from provider');
    const model = new MockLanguageModelV4({
      doGenerate: () => Promise.reject(providerError),
    });

    const err = await createAiPlanner(model, 'test-model')
      .plan('Anything')
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'AI_ERROR' });
    expect((err as Error).message).not.toContain('503');
    expect((err as Error).cause).toBe(providerError);
  });
});

describe('mock planner', () => {
  it('answers every example question with a plan that passes the catalog check', async () => {
    const planner = createMockPlanner();

    for (const question of EXAMPLE_QUESTIONS) {
      const plan = await planner.plan(question);
      expect(plan.kind, question).toBe('query');
      if (plan.kind === 'query') expect(() => validatePlan(plan)).not.toThrow();
    }
  });

  it('marks anything else unsupported', async () => {
    await expect(createMockPlanner().plan("What's the weather in Mumbai?")).resolves.toMatchObject({
      kind: 'unsupported',
    });
  });
});

describe('config', () => {
  it('requires GEMINI_API_KEY only for the google provider', () => {
    expect(() => loadConfig({})).toThrow(/GEMINI_API_KEY/);
    expect(() => loadConfig({ GEMINI_API_KEY: '' })).toThrow(/GEMINI_API_KEY/);
    expect(loadConfig({ AI_PROVIDER: 'mock' }).AI_MODEL).toBe('gemini-4-hydrogen');
  });

  it('names the variable that is wrong', () => {
    expect(() => loadConfig({ AI_PROVIDER: 'openai' })).toThrow(/AI_PROVIDER/);
  });
});
