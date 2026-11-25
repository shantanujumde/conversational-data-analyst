import { afterEach, describe, expect, it, vi } from 'vitest';
import { ask, getCatalog } from '../api/client';
import { barAnswer, catalog, lineAnswer, rateLimitedError, refusalError } from './fixtures';

function stubFetch(impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const failures = [
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
] as const;

describe('ask', () => {
  it('POSTs the question as JSON', async () => {
    const fetch = stubFetch(() => Promise.resolve(Response.json({ ok: true, data: barAnswer })));

    await ask('Which branches have the highest rejection rate?');

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe('/api/v1/ask');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json');
    expect(new Headers(init?.headers).get('Accept')).toBe('application/json');
    expect(init?.body).toBe(
      JSON.stringify({ question: 'Which branches have the highest rejection rate?' }),
    );
  });

  it.each([barAnswer, lineAnswer])('returns a valid answer ($visualization.type)', async (data) => {
    stubFetch(() => Promise.resolve(Response.json({ ok: true, data })));

    await expect(ask(data.question)).resolves.toEqual({ ok: true, data });
  });

  it.each([
    ['refusal with suggestions', refusalError, 422],
    ['rate limit with retryAfterSeconds', rateLimitedError, 429],
  ])('passes a server error body through unchanged (%s)', async (_case, error, status) => {
    stubFetch(() => Promise.resolve(Response.json({ ok: false, error }, { status })));

    await expect(ask('anything')).resolves.toEqual({ ok: false, error });
  });

  it.each(failures)('returns %s → %s', async (_case, impl, code) => {
    stubFetch(impl);

    const result = await ask('anything');
    expect(result).toMatchObject({ ok: false, error: { code } });
    expect(result.ok || result.error.message).toBeTruthy();
  });

  it('returns INVALID_RESPONSE when JSON fails the schema', async () => {
    const broken = { ...barAnswer, visualization: { type: 'pie' } };
    stubFetch(() => Promise.resolve(Response.json({ ok: true, data: broken })));

    await expect(ask('anything')).resolves.toEqual({
      ok: false,
      error: {
        code: 'INVALID_RESPONSE',
        message: "The server sent an answer we couldn't read. Please try again.",
      },
    });
  });

  it('never throws, even when reading the body fails', async () => {
    stubFetch(() =>
      Promise.resolve({
        status: 200,
        text: () => Promise.reject(new TypeError('body stream already read')),
      } as Response),
    );

    await expect(ask('anything')).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_RESPONSE' },
    });
  });
});

describe('getCatalog', () => {
  it('returns parsed data for a valid OK response', async () => {
    const fetch = stubFetch(() => Promise.resolve(Response.json({ ok: true, data: catalog })));

    await expect(getCatalog()).resolves.toEqual({ ok: true, data: catalog });
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/v1/catalog');
  });

  it('returns INVALID_RESPONSE for an empty examples list', async () => {
    stubFetch(() =>
      Promise.resolve(Response.json({ ok: true, data: { ...catalog, examples: [] } })),
    );

    await expect(getCatalog()).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_RESPONSE' },
    });
  });
});
