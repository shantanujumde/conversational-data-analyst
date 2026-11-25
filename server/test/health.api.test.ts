import { ApiResponseSchema, HealthSchema } from '@cda/shared';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createMockPlanner } from '../src/ai/mockPlanner';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { createTestDb } from './helpers/testDb';

const testDb = createTestDb();
afterAll(() => testDb.cleanup());

const config = loadConfig({ AI_PROVIDER: 'mock', NODE_ENV: 'test' });
const app = createApp({ config, db: testDb.db, planner: createMockPlanner(), askRateLimit: false });

describe('GET /api/v1/health', () => {
  it('returns 200 with a valid health body and no caching', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-request-id']).toBeTruthy();
    const body = ApiResponseSchema(HealthSchema).parse(res.body);
    expect(body).toMatchObject({ ok: true, data: { status: 'ok' } });
  });

  it('reports degraded when the database check fails', async () => {
    const closed = createTestDb();
    closed.cleanup(); // closes the connection, so SELECT 1 throws
    const degradedApp = createApp({
      config,
      db: closed.db,
      planner: createMockPlanner(),
      askRateLimit: false,
    });

    const res = await request(degradedApp).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, data: { status: 'degraded' } });
  });

  it('returns 405 with an Allow header for other methods', async () => {
    const res = await request(app).post('/api/v1/health');

    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe('GET, HEAD');
    expect(res.body).toMatchObject({ ok: false, error: { code: 'METHOD_NOT_ALLOWED' } });
  });
});

describe('error responses', () => {
  it.each([
    ['unknown route', () => request(app).get('/api/v1/nope'), 404, 'NOT_FOUND'],
    [
      'malformed JSON',
      () => request(app).post('/api/v1/ask').type('json').send('{"bad json'),
      400,
      'VALIDATION_ERROR',
    ],
    [
      'body over 10 KB',
      () =>
        request(app)
          .post('/api/v1/ask')
          .send({ question: 'x'.repeat(11 * 1024) }),
      413,
      'VALIDATION_ERROR',
    ],
  ])('%s → %i %s', async (_case, send, status, code) => {
    const res = await send();

    expect(res.status).toBe(status);
    expect(res.body).toMatchObject({ ok: false, error: { code } });
    expect((res.body as { error: { requestId: string } }).error.requestId).toBe(
      res.headers['x-request-id'],
    );
    expect(JSON.stringify(res.body)).not.toMatch(/stack|at .+\.ts/);
  });
});
