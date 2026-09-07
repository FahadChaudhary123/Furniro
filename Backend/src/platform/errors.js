/**
 * Error handling — PLAT-04.
 *
 * Express 5 forwards a rejected promise from an async handler to the error middleware
 * automatically. The `try/catch`-and-`next(err)` wrapper Express 4 required is obsolete —
 * handlers should just throw.
 *
 * Response shape is fixed by docs/API.md#error-shape. A 500 NEVER includes a stack trace,
 * a SQL fragment, or a driver message: those are logged with the correlation id, and the
 * client gets the id, not the cause.
 */

import { logger } from './logger.js';
import { config } from './config.js';

/** An error with an intended HTTP status and a stable machine-readable code. */
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expected = true; // distinguishes "the client did something wrong" from "we broke"
  }
}

export const badRequest = (message, details) =>
  new AppError(400, 'BAD_REQUEST', message, details);
export const validationFailed = (details, message = 'Request failed validation.') =>
  new AppError(400, 'VALIDATION_FAILED', message, details);
export const unauthorized = (message = 'Authentication required.') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Not permitted.') =>
  new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Resource not found.') =>
  new AppError(404, 'NOT_FOUND', message);
export const conflict = (message, details) =>
  new AppError(409, 'CONFLICT', message, details);

/** Terminal 404 for unmatched routes. Mounted after every router. */
export function notFoundHandler(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `No route matches ${req.method} ${req.path}`));
}

/**
 * Error middleware. MUST be registered last and MUST keep all four parameters — Express
 * identifies error middleware by arity, so dropping `next` silently turns this into a
 * normal handler that never runs.
 */
// eslint-disable-next-line no-unused-vars -- the 4th parameter is what makes this error middleware
export function errorHandler(err, req, res, next) {
  const expected = err instanceof AppError && err.expected;
  const status = expected ? err.status : 500;
  const code = expected ? err.code : 'INTERNAL_ERROR';

  if (status >= 500) {
    // The cause is logged, never returned.
    logger.error(err.message, {
      code,
      status,
      method: req.method,
      path: req.path,
      stack: err.stack,
    });
  } else {
    logger.warn(err.message, { code, status, method: req.method, path: req.path });
  }

  if (res.headersSent) return next(err);

  const body = {
    error: {
      code,
      message: expected ? err.message : 'An unexpected error occurred.',
      correlationId: req.correlationId ?? null,
    },
  };

  if (expected && err.details) body.error.details = err.details;

  // Stacks in development only, and never for an expected error.
  if (!expected && !config.isProduction) body.error.debug = err.stack;

  res.status(status).json(body);
}
