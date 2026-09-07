/**
 * Correlation IDs — PLAT-02.
 *
 * One id per request, propagated through every log line and returned to the client on
 * `X-Correlation-Id`. Doc B §7 R2 diagnoses elevated checkout errors by inspecting
 * "correlation IDs from failing sessions in traces and logs"; Doc B §6 returns an id to the
 * customer rather than a stack trace.
 *
 * Uses AsyncLocalStorage so the id is available anywhere in the request's async call tree
 * without threading a context argument through every function signature. Retrofitting this
 * across 20 modules later is far more expensive than starting with it.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const storage = new AsyncLocalStorage();

/** The current request's correlation id, or null outside a request. */
export const getCorrelationId = () => storage.getStore()?.correlationId ?? null;

/** Run a function inside a correlation scope. Used by jobs, which have no HTTP request. */
export const withCorrelationId = (correlationId, fn) =>
  storage.run({ correlationId }, fn);

const HEADER = 'x-correlation-id';
// Accept an upstream id only if it looks like one — an unvalidated header ends up in logs.
const VALID = /^[A-Za-z0-9_-]{8,64}$/;

export function correlationMiddleware(req, res, next) {
  const incoming = req.get(HEADER);
  const correlationId = incoming && VALID.test(incoming) ? incoming : randomUUID();

  req.correlationId = correlationId;
  res.set('X-Correlation-Id', correlationId);

  storage.run({ correlationId }, next);
}
