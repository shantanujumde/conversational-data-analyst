import type { ErrorCode } from '@cda/shared';

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNSUPPORTED_QUESTION: 422,
  AI_ERROR: 502,
  QUERY_ERROR: 500,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  INTERNAL_ERROR: 500,
};

// User-facing text from SPEC §10.1.
const DEFAULT_MESSAGE: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Please type a question.',
  UNSUPPORTED_QUESTION:
    'I can only answer questions about branches, customers, onboarding applications and transactions.',
  AI_ERROR: 'The AI service ran into a problem. Please try again.',
  QUERY_ERROR: 'Something went wrong while reading the data. Please try again.',
  RATE_LIMITED: 'Too many questions at once. Please try again shortly.',
  NOT_FOUND: "That address doesn't exist.",
  METHOD_NOT_ALLOWED: "That address doesn't accept this method.",
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
};

interface AppErrorExtra {
  suggestions?: string[];
  retryAfterSeconds?: number;
  /** Overrides the status for this code. Used only for 413. */
  status?: number;
}

/** An error that is safe to show the client. `cause` is logged but never sent. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly extra: AppErrorExtra = {},
    options?: { cause?: unknown },
  ) {
    super(message ?? DEFAULT_MESSAGE[code], options);
    this.name = 'AppError';
  }

  get status(): number {
    return this.extra.status ?? STATUS[this.code];
  }
}

/** RATE_LIMITED with the SPEC §10.1 text and the wait the client counts down from. */
export function rateLimited(seconds: number): AppError {
  return new AppError(
    'RATE_LIMITED',
    `Too many questions at once. Try again in ${seconds} seconds.`,
    {
      retryAfterSeconds: seconds,
    },
  );
}

const BODY_PARSER_ERRORS: Record<string, () => AppError> = {
  'entity.parse.failed': () => new AppError('VALIDATION_ERROR', 'Request body is not valid JSON.'),
  'entity.too.large': () =>
    new AppError('VALIDATION_ERROR', 'Request is too large.', { status: 413 }),
};

/** Turns anything thrown into an AppError. Unknown errors become INTERNAL_ERROR. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  const type =
    typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string'
      ? err.type
      : undefined;
  const fromBodyParser = type ? BODY_PARSER_ERRORS[type] : undefined;
  if (fromBodyParser) return fromBodyParser();

  return new AppError('INTERNAL_ERROR', undefined, {}, { cause: err });
}
