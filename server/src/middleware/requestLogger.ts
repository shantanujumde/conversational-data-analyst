import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { pinoHttp } from 'pino-http';
import type { Logger } from '../logger';

/** An incoming id is reused only if it is short and plain, so it can't inject into logs or headers. */
const SAFE_REQUEST_ID = /^[\w.:-]{1,128}$/;

export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Gives every request an id (the caller's `X-Request-Id`, or a new UUID), sends it back in the
 * `X-Request-Id` header and logs one line per request: method, path, status and duration.
 */
export function requestLogger(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    genReqId(req, res) {
      const incoming = req.headers['x-request-id'];
      const id =
        typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
      res.setHeader(REQUEST_ID_HEADER, id);
      return id;
    },
    // errorHandler logs errors with their detail; this line is just the access log.
    customLogLevel: () => 'info',
    serializers: {
      req: (req: { id: unknown; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url,
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  });
}
