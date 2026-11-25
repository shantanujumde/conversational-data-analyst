import { apiResponseSchema, HealthSchema } from '@cda/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

const app = createApp(loadConfig({ NODE_ENV: 'test' }));

describe('GET /api/v1/health', () => {
  it('returns 200 with a valid health body and no caching', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['cache-control']).toBe('no-store');
    const body = apiResponseSchema(HealthSchema).parse(res.body);
    expect(body.ok).toBe(true);
  });

  it('returns 405 with an Allow header for other methods', async () => {
    const res = await request(app).post('/api/v1/health');

    expect(res.status).toBe(405);
    expect(res.headers.allow).toBe('GET');
    expect(res.body).toMatchObject({ ok: false, error: { code: 'METHOD_NOT_ALLOWED' } });
  });
});

describe('error handling', () => {
  it('returns 404 NOT_FOUND for unknown routes', async () => {
    const res = await request(app).get('/api/v1/nope');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('returns 400 VALIDATION_ERROR for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{"bad json');

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
  });
});
