import {
  ApiResponseSchema,
  AskResultSchema,
  CatalogResponseSchema,
  ErrorBodySchema,
} from '@cda/shared';
import request, { type Response } from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createMockPlanner } from '../src/ai/mockPlanner';
import type { Planner } from '../src/ai/planner';
import { createApp } from '../src/app';
import { SUGGESTIONS } from '../src/catalog/examples';
import { loadConfig } from '../src/config';
import { AppError } from '../src/errors';
import { createTestDb } from './helpers/testDb';

const testDb = createTestDb();
afterAll(() => testDb.cleanup());

/** A high rate limit, so only the rate-limit test ever hits it. */
const config = loadConfig({
  AI_PROVIDER: 'mock',
  NODE_ENV: 'test',
  ASK_RATE_LIMIT_PER_MINUTE: '1000',
});
const makeApp = (planner: Planner = createMockPlanner(), appConfig = config) =>
  createApp({ config: appConfig, db: testDb.db, planner });
const app = makeApp();

const ask = (question: unknown, target = app) =>
  request(target).post('/api/v1/ask').send({ question });

/** Every error: valid ErrorBody, requestId equal to the X-Request-Id header, nothing internal leaked. */
function expectError(res: Response, status: number, code: string) {
  expect(res.status).toBe(status);
  const body = ApiResponseSchema(AskResultSchema).parse(res.body);
  expect(body.ok).toBe(false);
  const error = ErrorBodySchema.parse((res.body as { error: unknown }).error);
  expect(error.code).toBe(code);
  expect(error.requestId).toBe(res.headers['x-request-id']);
  expect(JSON.stringify(res.body)).not.toMatch(/stack|\.ts:\d+|SQLITE|provider|upstream/i);
  return error;
}

function okData(res: Response) {
  expect(res.status).toBe(200);
  const body = ApiResponseSchema(AskResultSchema).parse(res.body);
  if (!body.ok) throw new Error(`Expected ok, got ${body.error.code}`);
  return body.data;
}

describe('POST /api/v1/ask', () => {
  it('answers the rejection-rate question with a bar chart sorted highest first', async () => {
    const res = await ask('Which branches have the highest rejection rate?');
    const data = okData(res);

    expect(data.visualization).toEqual({ type: 'bar', x: 'branch', y: 'rejection_rate' });
    expect(data.columns.map((c) => c.key)).toEqual(['branch', 'rejection_rate']);
    const rates = data.rows.map((r) => r.rejection_rate as number);
    expect(rates).toEqual([...rates].sort((a, b) => b - a));
    expect(data.rows[0]?.branch).toBe('North Point');
    expect(data.text).toMatch(/^North Point has the highest rejection rate at \d+\.\d%\.$/);
    expect(data.query).toMatchObject({
      dataset: 'applications',
      sql: expect.stringMatching(/LIMIT \?$/) as unknown,
    });
    expect(data.meta.provider).toBe('mock');
    expect(res.headers['x-request-id']).toMatch(/^[\w-]{36}$/);
  });

  it('answers the monthly segment question with a line chart in month order', async () => {
    const data = okData(await ask('Show monthly onboarding applications by customer segment'));

    expect(data.visualization).toEqual({
      type: 'line',
      x: 'month',
      y: 'application_count',
      series: 'segment',
    });
    const months = data.rows.map((r) => r.month as string);
    expect(months).toEqual([...months].sort());
    expect(new Set(months).size).toBe(12);
  });

  it('answers a single figure with a KPI card', async () => {
    const data = okData(await ask('How many onboarding applications were rejected?'));

    expect(data.visualization).toEqual({
      type: 'kpi',
      valueKey: 'application_count',
      format: 'number',
    });
    expect(data.rows).toHaveLength(1);
    expect(data.text).toMatch(/^Applications with status Rejected: [\d,]+\.$/);
  });

  it('uses a table for two dimensions and two metrics', async () => {
    const data = okData(await ask('Show approval and rejection rate by region and channel'));

    expect(data.visualization).toEqual({ type: 'table' });
    expect(data.columns.map((c) => c.key)).toEqual([
      'region',
      'channel',
      'approval_rate',
      'rejection_rate',
    ]);
  });

  it('formats INR in the top customers answer', async () => {
    const data = okData(await ask('Show the top five customers by transaction value'));

    expect(data.rows).toHaveLength(5);
    expect(data.text).toMatch(/has the highest total value at ₹[\d,]+\.\d{2}\.$/);
  });

  /** A planner that always returns this plan for January 2020, a month with no data. */
  const january2020 = (metric: string): Planner => ({
    provider: 'mock',
    model: 'fixed',
    plan: () =>
      Promise.resolve({
        kind: 'query',
        dataset: 'applications',
        metrics: [metric],
        groupBy: [],
        filters: [],
        dateRange: { from: '2020-01-01', to: '2020-01-31' },
        title: 'January 2020',
      }),
  });

  it('shows a count of 0 as a real KPI answer', async () => {
    const data = okData(
      await ask('Applications in January 2020', makeApp(january2020('application_count'))),
    );

    expect(data).toMatchObject({
      text: 'Applications from 2020-01-01 to 2020-01-31: 0.',
      visualization: { type: 'kpi', valueKey: 'application_count' },
      rows: [{ application_count: 0 }],
    });
  });

  it('returns a text answer, not an error, when nothing matches', async () => {
    const data = okData(
      await ask('Approval rate in January 2020', makeApp(january2020('approval_rate'))),
    );

    expect(data).toMatchObject({
      text: 'No data matched this question.',
      visualization: { type: 'text' },
      rows: [],
    });
  });

  it.each([
    ['an empty question', '   ', 'Please type a question.'],
    ['a non-string question', 42, 'Please type a question.'],
    ['a question over 500 characters', 'x'.repeat(501), 'Questions can be up to 500 characters.'],
  ])('rejects %s with 400', async (_case, question, message) => {
    const error = expectError(await ask(question), 400, 'VALIDATION_ERROR');
    expect(error.message).toBe(message);
  });

  it.each([
    ['no body', () => request(app).post('/api/v1/ask')],
    ['an array body', () => request(app).post('/api/v1/ask').send(['How many customers?'])],
  ])('rejects %s with 400 and our own message', async (_case, send) => {
    const error = expectError(await send(), 400, 'VALIDATION_ERROR');
    expect(error.message).toBe('Please type a question.');
  });

  it('refuses an off-topic question with 422 and three suggestions', async () => {
    const error = expectError(
      await ask("What's the weather in Mumbai?"),
      422,
      'UNSUPPORTED_QUESTION',
    );

    expect(error.suggestions).toEqual(SUGGESTIONS);
    expect(error.message).toBe(
      'I can only answer questions about branches, customers, onboarding applications and transactions.',
    );
  });

  it('refuses a plan that breaks the catalog with 422', async () => {
    const planner: Planner = {
      provider: 'mock',
      model: 'bad',
      plan: () =>
        Promise.resolve({
          kind: 'query',
          dataset: 'customers',
          metrics: ['customer_count'],
          groupBy: ['segment; DROP TABLE customers'],
          filters: [],
          title: 'Injected',
        }),
    };
    expectError(await ask('Anything', makeApp(planner)), 422, 'UNSUPPORTED_QUESTION');
    expect(testDb.db.prepare('SELECT COUNT(*) AS n FROM customers').get()).toEqual({ n: 200 });
  });

  it('answers 502 AI_ERROR when the planner fails, without leaking the provider error', async () => {
    const planner: Planner = {
      provider: 'google',
      model: 'broken',
      plan: () =>
        Promise.reject(
          new AppError(
            'AI_ERROR',
            undefined,
            {},
            { cause: new Error('upstream provider 503: quota') },
          ),
        ),
    };
    const error = expectError(
      await ask('Which branches have the highest rejection rate?', makeApp(planner)),
      502,
      'AI_ERROR',
    );

    expect(error.message).toBe('The AI service ran into a problem. Please try again.');
  });

  it('answers 500 INTERNAL_ERROR for an unexpected throw', async () => {
    const planner: Planner = {
      provider: 'mock',
      model: 'throws',
      plan: () => Promise.reject(new TypeError('cannot read x of undefined')),
    };
    expectError(await ask('Anything', makeApp(planner)), 500, 'INTERNAL_ERROR');
  });

  it('reuses a safe incoming X-Request-Id', async () => {
    const res = await request(app)
      .post('/api/v1/ask')
      .set('X-Request-Id', 'trace-123')
      .send({ question: '' });

    expect(expectError(res, 400, 'VALIDATION_ERROR').requestId).toBe('trace-123');
  });

  it('replaces an unsafe incoming X-Request-Id', async () => {
    const res = await request(app)
      .post('/api/v1/ask')
      .set('X-Request-Id', 'a b{}')
      .send({ question: '' });

    expect(expectError(res, 400, 'VALIDATION_ERROR').requestId).not.toBe('a b{}');
  });

  it('returns 405 with an Allow header for GET', async () => {
    const res = await request(app).get('/api/v1/ask');

    expectError(res, 405, 'METHOD_NOT_ALLOWED');
    expect(res.headers.allow).toBe('POST');
  });

  it('rate limits with 429, Retry-After and retryAfterSeconds', async () => {
    const limited = makeApp(createMockPlanner(), { ...config, ASK_RATE_LIMIT_PER_MINUTE: 1 });
    okData(await ask('Which branches have the highest rejection rate?', limited));

    const res = await ask('Which branches have the highest rejection rate?', limited);
    const error = expectError(res, 429, 'RATE_LIMITED');
    expect(error.retryAfterSeconds).toBeGreaterThan(0);
    expect(res.headers['retry-after']).toBe(String(error.retryAfterSeconds));
    expect(error.message).toBe(
      `Too many questions at once. Try again in ${error.retryAfterSeconds} seconds.`,
    );
  });
});

describe('GET /api/v1/catalog', () => {
  it('lists the datasets and the four brief questions, in brief order', async () => {
    const res = await request(app).get('/api/v1/catalog');

    expect(res.status).toBe(200);
    const body = ApiResponseSchema(CatalogResponseSchema).parse(res.body);
    if (!body.ok) throw new Error('expected ok');
    expect(body.data.datasets.map((d) => d.id)).toEqual([
      'applications',
      'transactions',
      'customers',
    ]);
    expect(body.data.examples).toEqual([
      'Show monthly onboarding applications by customer segment',
      'Which branches have the highest rejection rate?',
      'Compare retail and SME onboarding volumes',
      'Show the top five customers by transaction value',
    ]);
  });
});

describe('unknown routes', () => {
  it('returns 404 NOT_FOUND with a matching request id', async () => {
    expectError(await request(app).get('/api/v1/nope'), 404, 'NOT_FOUND');
  });
});
