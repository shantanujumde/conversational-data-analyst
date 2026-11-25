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

  it('passes through a server error response', async () => {
    const error = { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.' };
    stubFetch(() => Promise.resolve(Response.json({ ok: false, error }, { status: 500 })));

    await expect(getHealth()).resolves.toEqual({ ok: false, error });
  });

  it('returns NETWORK_ERROR when fetch throws', async () => {
    stubFetch(() => Promise.reject(new TypeError('fetch failed')));

    const result = await getHealth();
    expect(result).toMatchObject({ ok: false, error: { code: 'NETWORK_ERROR' } });
  });

  it('returns NETWORK_ERROR when a proxy answers 502 with a non-JSON body', async () => {
    stubFetch(() => Promise.resolve(new Response('', { status: 502 })));

    const result = await getHealth();
    expect(result).toMatchObject({ ok: false, error: { code: 'NETWORK_ERROR' } });
  });

  it('returns INVALID_RESPONSE when the body does not match the schema', async () => {
    stubFetch(() => Promise.resolve(new Response('<html>not json</html>')));

    const result = await getHealth();
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_RESPONSE' } });
  });
});
