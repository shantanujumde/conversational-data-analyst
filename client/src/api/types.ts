import type { ApiFailure, ApiSuccess, ErrorBody, ErrorCode } from '@cda/shared';

/** Codes the client creates itself; the server never sends them (SPEC §10.1). */
export const CLIENT_ONLY_CODES = ['NETWORK_ERROR', 'TIMEOUT', 'INVALID_RESPONSE'] as const;
export type ClientOnlyCode = (typeof CLIENT_ONLY_CODES)[number];

/** Server codes plus the client's own (SPEC §10.3). */
export type ClientErrorCode = ErrorCode | ClientOnlyCode;

export type ClientError = Omit<ErrorBody, 'code' | 'requestId'> & {
  code: ClientErrorCode;
  requestId?: string;
};

export type ApiResult<T> = ApiSuccess<T> | ApiFailure<ClientError>;
