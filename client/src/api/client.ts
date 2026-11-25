import {
  type ApiFailure,
  ApiResponseSchema,
  type ApiSuccess,
  type ErrorBody,
  type ErrorCode,
  type Health,
  HealthSchema,
} from '@cda/shared';
import type { z } from 'zod';

/** Server codes plus the ones the client creates itself (SPEC §10.3). */
export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE';

export type ApiResult<T> =
  ApiSuccess<T> | ApiFailure<Omit<ErrorBody, 'code'> & { code: ClientErrorCode }>;

// Texts from SPEC §10.1. They move to lib/errorView.ts with the chat UI.
const CLIENT_ERROR_MESSAGE = {
  NETWORK_ERROR: "Couldn't reach the server. Check your connection and try again.",
  TIMEOUT: 'This is taking too long. Please try again.',
  INVALID_RESPONSE: "The server sent an answer we couldn't read. Please try again.",
} as const;

type ClientOnlyCode = keyof typeof CLIENT_ERROR_MESSAGE;

function clientError(code: ClientOnlyCode): ApiResult<never> {
  return { ok: false, error: { code, message: CLIENT_ERROR_MESSAGE[code] } };
}

const TIMEOUT_MS = 20_000;

/** The only place that turns a failed request into a result. Never throws. */
async function request<T extends z.ZodType>(
  path: string,
  dataSchema: T,
  init?: RequestInit,
): Promise<ApiResult<z.infer<T>>> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...init,
    });
  } catch (err) {
    return clientError(
      err instanceof DOMException && err.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR',
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(await res.text());
  } catch {
    // A non-JSON 5xx comes from a proxy (e.g. the Vite dev proxy) when our API is down.
    return clientError(res.status >= 500 ? 'NETWORK_ERROR' : 'INVALID_RESPONSE');
  }

  const parsed = ApiResponseSchema(dataSchema).safeParse(json);
  return parsed.success ? (parsed.data as ApiResult<z.infer<T>>) : clientError('INVALID_RESPONSE');
}

export function getHealth(): Promise<ApiResult<Health>> {
  return request('/api/v1/health', HealthSchema);
}
