import pino, { type Level, type Logger } from 'pino';

export type { Logger };
export type LogLevel = Level | 'silent';

/**
 * Structured JSON logs. Pretty-printed only on an interactive terminal outside production.
 * Secrets are redacted in case they ever end up in a logged object.
 */
export function createLogger(level: LogLevel): Logger {
  const pretty = process.stdout.isTTY && process.env.NODE_ENV !== 'production';
  return pino({
    level,
    base: { service: 'cda-server' },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.apiKey',
        '*.GEMINI_API_KEY',
        '*.OPENAI_API_KEY',
        '*.API_KEY',
      ],
      censor: '[redacted]',
    },
    ...(pretty && level !== 'silent'
      ? { transport: { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss' } } }
      : {}),
  });
}
