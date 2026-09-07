/**
 * Structured logging — PLAT-03.
 *
 * JSON lines in production so a log aggregator can parse them; human-readable in
 * development. Every entry carries the correlation id when one is in scope, which is what
 * makes Doc B §7 R2 ("inspect correlation IDs from failing sessions") possible.
 *
 * NEVER log personal data, request bodies containing messages or emails, tokens, or
 * credentials. Log a correlation id and look up what you need deliberately.
 * See docs/SECURITY.md#handling-user-data.
 */

import { config } from './config.js';
import { getCorrelationId } from './correlation.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = LEVELS[config.logLevel] ?? LEVELS.info;

/** Keys whose values are never written to a log, at any depth. */
const REDACT = new Set([
  'password', 'token', 'secret', 'authorization', 'cookie', 'apikey', 'api_key',
  'anon_key', 'database_url', 'email', 'phone',
]);

function redact(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) =>
      REDACT.has(k.toLowerCase()) ? [k, '[redacted]'] : [k, redact(v, depth + 1)],
    ),
  );
}

function emit(level, message, meta = {}) {
  if (LEVELS[level] > threshold) return;

  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    correlationId: getCorrelationId(),
    ...redact(meta),
  };

  const line = config.isProduction
    ? JSON.stringify(entry)
    : `${entry.ts} ${level.toUpperCase().padEnd(5)} ${entry.correlationId ? `[${entry.correlationId}] ` : ''}${message}` +
      (Object.keys(meta).length ? ` ${JSON.stringify(redact(meta))}` : '');

  // eslint-disable-next-line no-console -- this is the logging sink
  (level === 'error' ? console.error : console.log)(line);
}

export const logger = {
  error: (message, meta) => emit('error', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  info: (message, meta) => emit('info', message, meta),
  debug: (message, meta) => emit('debug', message, meta),
};
