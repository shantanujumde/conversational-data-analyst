import { SUGGESTIONS } from '../catalog/examples';
import { AppError } from '../errors';

/**
 * The error for a question the catalog can't answer, from the AI or from the plan check.
 * The user sees the standard message and 3 suggestions; `reason` goes to the log only.
 */
export function unsupportedQuestion(reason: string): AppError {
  return new AppError(
    'UNSUPPORTED_QUESTION',
    undefined,
    { suggestions: [...SUGGESTIONS] },
    { cause: new Error(reason) },
  );
}
