import { ApiResponseSchema, HealthSchema } from '@cda/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

const app = createApp(loadConfig({ AI_PROVIDER: 'mock' }));

describe('GET /api/v1/health', () => {
  it('returns 200 with a valid health body and no caching', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(ApiResponseSchema(HealthSchema).parse(res.body).ok).toBe(true);
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
      () => request(app).post('/api/v1/health').type('json').send('{"bad json'),
      400,
      'VALIDATION_ERROR',
    ],
    [
      'body over 10 KB',
      () =>
        request(app)
          .post('/api/v1/health')
          .send({ text: 'x'.repeat(11 * 1024) }),
      413,
      'VALIDATION_ERROR',
    ],
  ])('%s → %i %s', async (_case, send, status, code) => {
    const res = await send();

    expect(res.status).toBe(status);
    expect(res.body).toMatchObject({ ok: false, error: { code } });
    expect(JSON.stringify(res.body)).not.toMatch(/stack|at .+\.ts/);
  });
});
