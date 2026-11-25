import { describe, expect, it } from 'vitest';
import { chatReducer, DEFAULT_RETRY_AFTER_SECONDS, type Entry } from '../src/hooks/useChat';
import { barAnswer, rateLimitedError, refusalError } from './fixtures';

const at = new Date(2026, 10, 25, 10, 0);

function asked(entries: Entry[] = [], id = 1, question = 'Which branch?') {
  return chatReducer(entries, { type: 'asked', id, question, at });
}

describe('chatReducer', () => {
  it('adds a pending entry with its number and date', () => {
    expect(asked()).toEqual([
      { id: 1, question: 'Which branch?', askedAt: at, state: { status: 'pending' } },
    ]);
  });

  it('settles the matching entry with the answer', () => {
    const entries = asked(asked(), 2, 'Another?');
    const next = chatReducer(entries, {
      type: 'settled',
      id: 2,
      result: { ok: true, data: barAnswer },
      now: 0,
    });

    expect(next[0]?.state).toEqual({ status: 'pending' });
    expect(next[1]?.state).toEqual({ status: 'answered', result: barAnswer });
  });

  it('records a failure without a wait for ordinary errors', () => {
    const next = chatReducer(asked(), {
      type: 'settled',
      id: 1,
      result: { ok: false, error: refusalError },
      now: 1000,
    });

    expect(next[0]?.state).toEqual({ status: 'failed', error: refusalError, retryAt: null });
  });

  it('sets retryAt from retryAfterSeconds when rate limited', () => {
    const next = chatReducer(asked(), {
      type: 'settled',
      id: 1,
      result: { ok: false, error: rateLimitedError },
      now: 1000,
    });

    expect(next[0]?.state).toMatchObject({ status: 'failed', retryAt: 1000 + 42_000 });
  });

  it('waits the default 10 s when a rate limit has no retryAfterSeconds', () => {
    const { retryAfterSeconds: _, ...noWait } = rateLimitedError;
    const next = chatReducer(asked(), {
      type: 'settled',
      id: 1,
      result: { ok: false, error: noWait },
      now: 1000,
    });

    expect(DEFAULT_RETRY_AFTER_SECONDS).toBe(10);
    expect(next[0]?.state).toMatchObject({ status: 'failed', retryAt: 1000 + 10_000 });
  });

  it('puts a failed entry back to pending on retry, keeping its number and question', () => {
    const failed = chatReducer(asked(), {
      type: 'settled',
      id: 1,
      result: { ok: false, error: { code: 'NETWORK_ERROR', message: 'offline' } },
      now: 0,
    });
    const retried = chatReducer(failed, { type: 'retried', id: 1 });

    expect(retried).toEqual([
      { id: 1, question: 'Which branch?', askedAt: at, state: { status: 'pending' } },
    ]);
  });

  it('ignores a result for an entry that is no longer pending', () => {
    const answered = chatReducer(asked(), {
      type: 'settled',
      id: 1,
      result: { ok: true, data: barAnswer },
      now: 0,
    });
    const late = chatReducer(answered, {
      type: 'settled',
      id: 1,
      result: { ok: false, error: refusalError },
      now: 0,
    });

    expect(late).toEqual(answered);
  });
});
