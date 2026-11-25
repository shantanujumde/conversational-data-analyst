import {
  type ApiFailure,
  ApiResponseSchema,
  type ApiSuccess,
  type AskResult,
  AskResultSchema,
  type CatalogResponse,
  CatalogResponseSchema,
  type ErrorBody,
  type ErrorCode,
  type Health,
  HealthSchema,
} from '@cda/shared';
import type { z } from 'zod';
import { errorView } from '@/lib/errorView';

/** Server codes plus the ones the client creates itself (SPEC §10.3). */
export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE';

export type ClientError = Omit<ErrorBody, 'code' | 'requestId'> & {
  code: ClientErrorCode;
  requestId?: string;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure<ClientError>;

type ClientOnlyCode = 'NETWORK_ERROR' | 'TIMEOUT' | 'INVALID_RESPONSE';

function clientError(code: ClientOnlyCode): ApiResult<never> {
  return { ok: false, error: { code, message: errorView[code].fallbackMessage } };
}

/** Longer than the server's worst case: two 30 s AI attempts (docs/SPEC.md §7). */
const TIMEOUT_MS = 65_000;

/** The only place that turns a failed request into a result. Never throws. */
async function request<T extends z.ZodType>(
  path: string,
  dataSchema: T,
  init: RequestInit = {},
): Promise<ApiResult<z.infer<T>>> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { Accept: 'application/json', ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
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

/** POST /api/v1/ask */
export function ask(question: string): Promise<ApiResult<AskResult>> {
  return request('/api/v1/ask', AskResultSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: question.trim() }),
  });
}

/** GET /api/v1/catalog */
export function getCatalog(): Promise<ApiResult<CatalogResponse>> {
  return request('/api/v1/catalog', CatalogResponseSchema);
}

/** GET /api/v1/health */
export function getHealth(): Promise<ApiResult<Health>> {
  return request('/api/v1/health', HealthSchema);
}
