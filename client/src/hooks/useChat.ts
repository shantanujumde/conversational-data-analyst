import type { AskResult } from '@cda/shared';
import { useCallback, useReducer, useRef } from 'react';
import { type ApiResult, ask, type ClientError } from '@/api/client';
import { logError } from '@/lib/log';

export type EntryState =
  | { status: 'pending' }
  | { status: 'answered'; result: AskResult }
  /** `retryAt` (epoch ms) is set for RATE_LIMITED: Try again waits until then. */
  | { status: 'failed'; error: ClientError; retryAt: number | null };

/** One question and its answer, printed as one passbook entry. */
export interface Entry {
  /** Entry number, from 1. Shown as "No. 001". */
  id: number;
  question: string;
  askedAt: Date;
  state: EntryState;
}

export type ChatAction =
  | { type: 'asked'; id: number; question: string; at: Date }
  | { type: 'retried'; id: number }
  | { type: 'settled'; id: number; result: ApiResult<AskResult>; now: number };

function settle(result: ApiResult<AskResult>, now: number): EntryState {
  if (result.ok) return { status: 'answered', result: result.data };
  const wait = result.error.code === 'RATE_LIMITED' ? result.error.retryAfterSeconds : undefined;
  return {
    status: 'failed',
    error: result.error,
    retryAt: wait === undefined ? null : now + wait * 1000,
  };
}

export function chatReducer(entries: Entry[], action: ChatAction): Entry[] {
  switch (action.type) {
    case 'asked':
      return [
        ...entries,
        {
          id: action.id,
          question: action.question,
          askedAt: action.at,
          state: { status: 'pending' },
        },
      ];
    case 'retried':
      return entries.map((e) =>
        e.id === action.id && e.state.status === 'failed'
          ? { ...e, state: { status: 'pending' } }
          : e,
      );
    case 'settled':
      // Only a pending entry takes a result, so a late answer can't overwrite a newer one.
      return entries.map((e) =>
        e.id === action.id && e.state.status === 'pending'
          ? { ...e, state: settle(action.result, action.now) }
          : e,
      );
  }
}

/** The list of entries and the ask flow. History lives in memory only. */
export function useChat() {
  const [entries, dispatch] = useReducer(chatReducer, []);
  const nextId = useRef(1);

  const send = useCallback(async (id: number, question: string) => {
    const result = await ask(question);
    if (!result.ok) logError('ask failed', result.error);
    dispatch({ type: 'settled', id, result, now: Date.now() });
  }, []);

  /** Prints a new entry for the question. Blank questions are ignored. */
  const askQuestion = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;
      const id = nextId.current++;
      dispatch({ type: 'asked', id, question: trimmed, at: new Date() });
      void send(id, trimmed);
    },
    [send],
  );

  /** Re-sends a failed entry's question into the same entry. */
  const retry = useCallback(
    (entry: Entry) => {
      if (entry.state.status !== 'failed') return;
      if (entry.state.retryAt !== null && Date.now() < entry.state.retryAt) return;
      dispatch({ type: 'retried', id: entry.id });
      void send(entry.id, entry.question);
    },
    [send],
  );

  return { entries, ask: askQuestion, retry };
}
