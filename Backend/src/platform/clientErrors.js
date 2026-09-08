/**
 * Client error reporting — `PLAT-04`.
 *
 * A React crash in a visitor's browser is invisible today. The server log records what the
 * server did; if the bundle throws after it responded 200, nothing anywhere knows. The blank
 * `/shop` page that prompted the whole end-to-end suite was exactly this shape, and it was
 * found by someone opening the page, not by any signal.
 *
 * This is the half of PLAT-04 that does not need a third-party service: the browser posts
 * what broke, and it lands in the same structured log as everything else, tied to the same
 * correlation id. Alerting still needs somewhere to alert.
 *
 * SECURITY. This is an unauthenticated public write — the only one in the API — so the
 * input handling matters more than the feature:
 *
 *   - Every field is read from an allowlist and truncated. Nothing else in the body is read,
 *     so an attacker cannot grow a log line by inventing keys.
 *   - The response is `204` with no body. Nothing submitted is ever echoed back, so this
 *     cannot be used to reflect content at another visitor.
 *   - `writeLimiter` applies, because an endpoint that writes a log line per request is an
 *     amplifier: cheap for the caller, disk for us.
 *   - Logged at `warn`, not `error`. A visitor's browser extension throwing is not a
 *     server fault, and burying real 500s under extension noise is how alerting gets muted.
 *
 * The bodies here are attacker-controlled strings. They are logged as JSON values, so a
 * newline cannot forge a log line, and the logger's redaction still applies.
 */

import { Router } from 'express';

import { logger } from './logger.js';
import { getCorrelationId } from './correlation.js';

/**
 * Field caps. A stack trace is genuinely long; everything else is not, and a cap is the
 * difference between a log line and a log flood.
 */
const LIMITS = {
  message: 500,
  stack: 4000,
  componentStack: 4000,
  url: 500,
  userAgent: 300,
  release: 100,
};

/** Report kinds we accept. Anything else is recorded as `unknown` rather than reflected. */
const KINDS = new Set(['render', 'unhandled-rejection', 'window-error', 'chunk-load']);

/**
 * Read one string field: must be a string, trimmed, truncated, empty becomes null.
 * Deliberately not throwing — a malformed report should still log what it can. A client
 * that has just crashed is not the right thing to argue with about schemas.
 */
function str(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…[truncated]` : trimmed;
}

export const clientErrorsRouter = Router();

/**
 * POST /api/client-errors
 *
 * Always answers 204, even for a body that made no sense. There is nothing useful a crashed
 * page can do with a 400, and returning validation detail to an anonymous caller only tells
 * an attacker what the parser accepts.
 */
clientErrorsRouter.post('/', (req, res) => {
  const body = req.body ?? {};
  const kind = typeof body.kind === 'string' && KINDS.has(body.kind) ? body.kind : 'unknown';

  const message = str(body.message, LIMITS.message);

  // A report with no message describes nothing. Drop it rather than log an empty line.
  if (!message) {
    res.status(204).end();
    return;
  }

  logger.warn('client error', {
    kind,
    message,
    // `url` is the page that broke, not a full referrer chain. Query strings can carry
    // search terms, so only the path is kept.
    path: str(body.path, LIMITS.url),
    stack: str(body.stack, LIMITS.stack),
    componentStack: str(body.componentStack, LIMITS.componentStack),
    release: str(body.release, LIMITS.release),
    userAgent: str(req.get('user-agent'), LIMITS.userAgent),
    correlationId: getCorrelationId(),
  });

  res.status(204).end();
});
