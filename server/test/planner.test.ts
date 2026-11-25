import { type QueryPlan, QueryPlanSchema } from '@cda/shared';
import { APICallError } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { createMockPlanner } from '../src/ai/mockPlanner';
import { toQueryPlanInput } from '../src/ai/aiPlanSchema';
import { createAiPlanner } from '../src/ai/planner';
import { createPlanner } from '../src/ai/provider';
import { EXAMPLE_QUESTIONS, SUGGESTIONS } from '../src/catalog/examples';
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

const TEST_MODEL = { provider: 'google', model: 'test-model' } as const;

/** What a model returns: the flat shape from `AiPlanSchema`, with unused fields null. */
const EMPTY_FLAT = {
  kind: 'query',
  reason: null,
  dataset: null,
  metrics: [],
  groupBy: [],
  filters: [],
  dateRange: null,
  sort: null,
  limit: null,
  title: null,
};
function flat(fields: Record<string, unknown>): string {
  return JSON.stringify({ ...EMPTY_FLAT, ...fields });
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
    const model = modelReturning(flat(rejectionPlan));
    const planner = createAiPlanner(model, TEST_MODEL);

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
      modelReturning(flat({ kind: 'unsupported', reason: 'weather' })),
      TEST_MODEL,
    );

    await expect(planner.plan('Weather in Mumbai?')).rejects.toMatchObject({
      code: 'UNSUPPORTED_QUESTION',
      extra: { suggestions: expect.any(Array) as unknown },
    });
  });

  it.each([
    ['output that is not JSON', 'Sure! Here is your plan.'],
    ['output that fails the schema', flat({ dataset: 'loans' })],
    ['a flat plan that fails the strict plan', flat({ dataset: 'applications', title: 'x' })],
  ])('turns %s into AI_ERROR', async (_case, text) => {
    const planner = createAiPlanner(modelReturning(text), TEST_MODEL);

    await expect(planner.plan('Anything')).rejects.toMatchObject({ code: 'AI_ERROR' });
  });

  it('turns a provider error into AI_ERROR and keeps the original as cause', async () => {
    const providerError = new Error('upstream 503 from provider');
    const model = new MockLanguageModelV4({
      doGenerate: () => Promise.reject(providerError),
    });

    const err = await createAiPlanner(model, TEST_MODEL)
      .plan('Anything')
      .catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'AI_ERROR' });
    expect((err as Error).message).not.toContain('503');
    expect((err as Error).cause).toBe(providerError);
  });
});

describe('AI planner retry', () => {
  const busy = () =>
    new APICallError({
      message: 'This model is currently experiencing high demand.',
      url: 'https://example.test',
      requestBodyValues: {},
      statusCode: 503,
      isRetryable: true,
    });
  const ok = modelReturning(flat(rejectionPlan));

  function modelFailingFirst(firstError: Error) {
    let calls = 0;
    return new MockLanguageModelV4({
      doGenerate: (options) => {
        calls += 1;
        if (calls === 1) return Promise.reject(firstError);
        return ok.doGenerate(options);
      },
    });
  }

  it('retries once after a busy provider and returns the plan', async () => {
    const model = modelFailingFirst(busy());

    await expect(createAiPlanner(model, TEST_MODEL).plan('Anything')).resolves.toEqual(
      rejectionPlan,
    );
    expect(model.doGenerateCalls).toHaveLength(2);
  });

  it('retries once after a timeout', async () => {
    const model = modelFailingFirst(new DOMException('timed out', 'TimeoutError'));

    await expect(createAiPlanner(model, TEST_MODEL).plan('Anything')).resolves.toEqual(
      rejectionPlan,
    );
  });

  it('gives up with AI_ERROR after two busy answers', async () => {
    const model = new MockLanguageModelV4({ doGenerate: () => Promise.reject(busy()) });

    await expect(createAiPlanner(model, TEST_MODEL).plan('Anything')).rejects.toMatchObject({
      code: 'AI_ERROR',
    });
    expect(model.doGenerateCalls).toHaveLength(2);
  });

  it('does not retry an error that is not retryable', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: () => Promise.reject(new Error('bad request')),
    });

    await expect(createAiPlanner(model, TEST_MODEL).plan('Anything')).rejects.toMatchObject({
      code: 'AI_ERROR',
    });
    expect(model.doGenerateCalls).toHaveLength(1);
  });
});

describe('mock planner', () => {
  it('answers every example question with a plan that passes the catalog check', async () => {
    const planner = createMockPlanner();

    for (const question of EXAMPLE_QUESTIONS) {
      const plan = await planner.plan(question);
      expect(() => validatePlan(plan), question).not.toThrow();
    }
  });

  it('throws UNSUPPORTED_QUESTION for anything else, like the AI planner', async () => {
    await expect(createMockPlanner().plan("What's the weather in Mumbai?")).rejects.toMatchObject({
      code: 'UNSUPPORTED_QUESTION',
      extra: { suggestions: SUGGESTIONS },
    });
  });
});

describe('provider choice', () => {
  it('builds an OpenAI planner that reports its provider and model', () => {
    const planner = createPlanner({
      AI_PROVIDER: 'openai',
      AI_MODEL: 'gpt-5.4-mini',
      API_KEY: 'o',
    });
    expect(planner).toMatchObject({ provider: 'openai', model: 'gpt-5.4-mini' });
  });
});

describe('config', () => {
  it('requires the key of the chosen provider only', () => {
    expect(() => loadConfig({})).toThrow(/GEMINI_API_KEY/);
    expect(() => loadConfig({ GEMINI_API_KEY: '' })).toThrow(/GEMINI_API_KEY/);
    expect(() => loadConfig({ AI_PROVIDER: 'openai', GEMINI_API_KEY: 'g' })).toThrow(
      /OPENAI_API_KEY/,
    );
    expect(loadConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'o' })).toMatchObject({
      AI_PROVIDER: 'openai',
      API_KEY: 'o',
    });
    expect(loadConfig({ AI_PROVIDER: 'mock' })).not.toHaveProperty('API_KEY');
  });

  it('picks a default model per provider, and AI_MODEL overrides it', () => {
    expect(loadConfig({ GEMINI_API_KEY: 'g' }).AI_MODEL).toBe('gemini-4-hydrogen');
    expect(loadConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'o' }).AI_MODEL).toBe(
      'gpt-5.4-mini',
    );
    expect(
      loadConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'o', AI_MODEL: 'gpt-5.4' }).AI_MODEL,
    ).toBe('gpt-5.4');
  });

  it('names the variable that is wrong', () => {
    expect(() => loadConfig({ AI_PROVIDER: 'anthropic' })).toThrow(/AI_PROVIDER/);
  });

  it('reads the ask rate limit, 20 per minute by default', () => {
    expect(loadConfig({ AI_PROVIDER: 'mock' }).ASK_RATE_LIMIT_PER_MINUTE).toBe(20);
    expect(
      loadConfig({ AI_PROVIDER: 'mock', ASK_RATE_LIMIT_PER_MINUTE: '5' }).ASK_RATE_LIMIT_PER_MINUTE,
    ).toBe(5);
    expect(() => loadConfig({ AI_PROVIDER: 'mock', ASK_RATE_LIMIT_PER_MINUTE: '0' })).toThrow(
      /ASK_RATE_LIMIT_PER_MINUTE/,
    );
  });
});

describe('flat AI plan → strict plan', () => {
  it('drops null fields and keeps the rest', () => {
    const rebuilt = toQueryPlanInput({
      ...EMPTY_FLAT,
      kind: 'query',
      dataset: 'applications',
      metrics: ['application_count'],
      sort: { by: 'application_count', direction: 'desc' },
      title: 'Applications',
    });
    expect(rebuilt).toEqual({
      kind: 'query',
      dataset: 'applications',
      metrics: ['application_count'],
      groupBy: [],
      filters: [],
      sort: { by: 'application_count', direction: 'desc' },
      title: 'Applications',
    });
  });

  it('caps a limit above 100 and cuts a fraction to a whole number', () => {
    const flat = { ...EMPTY_FLAT, kind: 'query', dataset: 'applications', title: 'T' } as const;
    expect(toQueryPlanInput({ ...flat, limit: 150 })).toMatchObject({ limit: 100 });
    expect(toQueryPlanInput({ ...flat, limit: 5.7 })).toMatchObject({ limit: 5 });
    expect(toQueryPlanInput({ ...flat, limit: 0 })).not.toHaveProperty('limit');
  });

  it('uses the question when the title is missing, and shortens a long title', () => {
    const flat = { ...EMPTY_FLAT, kind: 'query', dataset: 'applications' } as const;
    expect(toQueryPlanInput({ ...flat, title: null }, 'How many applications?')).toMatchObject({
      title: 'How many applications?',
    });
    const long = toQueryPlanInput({ ...flat, title: 'x'.repeat(120) }) as { title: string };
    expect(long.title).toHaveLength(80);
    expect(long.title.endsWith('…')).toBe(true);
  });

  it('turns an over-long limit and title into a plan QueryPlanSchema accepts', () => {
    const rebuilt = toQueryPlanInput(
      {
        ...EMPTY_FLAT,
        kind: 'query',
        dataset: 'applications',
        metrics: ['application_count'],
        limit: 150,
        title: 'y'.repeat(90),
      },
      'q',
    );
    expect(QueryPlanSchema.safeParse(rebuilt).success).toBe(true);
  });

  it('keeps only the reason for an unsupported plan', () => {
    expect(toQueryPlanInput({ ...EMPTY_FLAT, kind: 'unsupported', reason: 'weather' })).toEqual({
      kind: 'unsupported',
      reason: 'weather',
    });
  });
});
