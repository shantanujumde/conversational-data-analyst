import { type ApiError, apiResponseSchema, HealthSchema, type Health } from '@cda/shared';
import type { z } from 'zod';

/** Errors the client creates itself; the server never sends these codes. */
export type ClientErrorCode = 'NETWORK_ERROR' | 'INVALID_RESPONSE';

export type ClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError | { code: ClientErrorCode; message: string } };

const NETWORK_ERROR = {
  ok: false,
  error: { code: 'NETWORK_ERROR', message: "Can't reach the API server. Is npm run dev running?" },
} as const satisfies ClientResult<never>;

const GATEWAY_STATUSES = new Set([502, 503, 504]);

async function request<T extends z.ZodType>(
  path: string,
  dataSchema: T,
  init?: RequestInit,
): Promise<ClientResult<z.infer<T>>> {
  let res: Response;
  try {
    res = await fetch(path, { headers: { Accept: 'application/json' }, ...init });
  } catch {
    return NETWORK_ERROR;
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = undefined;
  }

  const parsed = apiResponseSchema(dataSchema).safeParse(json);
  if (!parsed.success) {
    // A gateway error without our JSON body comes from a proxy (e.g. the Vite dev proxy)
    // when the API server is down, so report it as unreachable.
    if (GATEWAY_STATUSES.has(res.status)) return NETWORK_ERROR;
    return {
      ok: false,
      error: { code: 'INVALID_RESPONSE', message: 'The server sent an unexpected response.' },
    };
  }
  return parsed.data as ClientResult<z.infer<T>>;
}

export function getHealth(): Promise<ClientResult<Health>> {
  return request('/api/v1/health', HealthSchema);
}
