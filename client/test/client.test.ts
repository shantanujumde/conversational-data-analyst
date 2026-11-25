import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHealth } from '../src/api/client';

function stubFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getHealth', () => {
  it('returns parsed data for a valid OK response', async () => {
    const data = {
      status: 'ok',
      service: 'cda-server',
      version: '0.1.0',
      uptimeSeconds: 5,
      timestamp: '2026-11-25T10:00:00.000Z',
    };
    stubFetch(() => Promise.resolve(Response.json({ ok: true, data })));

    await expect(getHealth()).resolves.toEqual({ ok: true, data });
  });

  it('passes a server error body through unchanged', async () => {
    const error = { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.' };
    stubFetch(() => Promise.resolve(Response.json({ ok: false, error }, { status: 500 })));

    await expect(getHealth()).resolves.toEqual({ ok: false, error });
  });

  it.each([
    ['fetch rejects', () => Promise.reject(new TypeError('fetch failed')), 'NETWORK_ERROR'],
    [
      'fetch times out',
      () => Promise.reject(new DOMException('timed out', 'TimeoutError')),
      'TIMEOUT',
    ],
    [
      'a proxy answers 502 with HTML',
      () => Promise.resolve(new Response('<html>Bad Gateway</html>', { status: 502 })),
      'NETWORK_ERROR',
    ],
    [
      'the body is not JSON',
      () => Promise.resolve(new Response('<html>not json</html>')),
      'INVALID_RESPONSE',
    ],
    [
      'JSON fails the schema',
      () => Promise.resolve(Response.json({ ok: true, data: { status: 'up' } })),
      'INVALID_RESPONSE',
    ],
  ])('returns %s → %s', async (_case, impl, code) => {
    stubFetch(impl);

    await expect(getHealth()).resolves.toMatchObject({ ok: false, error: { code } });
  });
});
