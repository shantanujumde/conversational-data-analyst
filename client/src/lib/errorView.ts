import type { ClientErrorCode } from '@/api/client';

export type StampText = 'NOT IN LEDGER' | 'COULD NOT PRINT';

export interface ErrorView {
  /** The rubber stamp on the entry. `null` for codes the UI never shows (wrong address or method). */
  stamp: StampText | null;
  /** Whether the entry offers "Try again". */
  retry: boolean;
  /** Shown when the error has no message of its own (the client-only codes). */
  fallbackMessage: string;
}

/**
 * How each error code looks on an entry (docs/SPEC.md §10.1). It's a `Record`,
 * so a new code that isn't handled here fails `tsc`.
 */
export const errorView: Record<ClientErrorCode, ErrorView> = {
  VALIDATION_ERROR: {
    stamp: 'COULD NOT PRINT',
    retry: false,
    fallbackMessage: 'Please type a question.',
  },
  UNSUPPORTED_QUESTION: {
    stamp: 'NOT IN LEDGER',
    retry: false,
    fallbackMessage:
      'I can only answer questions about branches, customers, onboarding applications and transactions.',
  },
  AI_ERROR: {
    stamp: 'COULD NOT PRINT',
    retry: true,
    fallbackMessage: 'The AI service ran into a problem. Please try again.',
  },
  QUERY_ERROR: {
    stamp: 'COULD NOT PRINT',
    retry: true,
    fallbackMessage: 'Something went wrong while reading the data. Please try again.',
  },
  RATE_LIMITED: {
    stamp: 'COULD NOT PRINT',
    retry: true,
    fallbackMessage: 'Too many questions at once. Try again in a few seconds.',
  },
  NOT_FOUND: {
    stamp: null,
    retry: false,
    fallbackMessage: "That address doesn't exist.",
  },
  METHOD_NOT_ALLOWED: {
    stamp: null,
    retry: false,
    fallbackMessage: "That address doesn't accept this method.",
  },
  INTERNAL_ERROR: {
    stamp: 'COULD NOT PRINT',
    retry: true,
    fallbackMessage: 'Something went wrong on our side. Please try again.',
  },
  NETWORK_ERROR: {
    stamp: 'COULD NOT PRINT',
    retry: true,
    fallbackMessage: "Couldn't reach the server. Check your connection and try again.",
  },
  TIMEOUT: {
    stamp: 'COULD NOT PRINT',
    retry: true,
    fallbackMessage: 'This is taking too long. Please try again.',
  },
  INVALID_RESPONSE: {
    stamp: 'COULD NOT PRINT',
    retry: true,
    fallbackMessage: "The server sent an answer we couldn't read. Please try again.",
  },
};

/**
 * The RATE_LIMITED message, built from the live countdown so it never goes stale
 * (the server's "Try again in 42 seconds" is only true when it arrives).
 */
export function rateLimitMessage(secondsLeft: number): string {
  if (secondsLeft <= 0) return 'Too many questions at once. You can try again now.';
  return `Too many questions at once. Try again in ${secondsLeft} ${secondsLeft === 1 ? 'second' : 'seconds'}.`;
}
