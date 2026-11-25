import type { ErrorCode } from '@cda/shared';

/** An error that is safe to show the client: its code, HTTP status and message go out as-is. */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
