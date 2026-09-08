/**
 * Platform module — public interface.
 *
 * Every other module may depend on this one; it depends on nothing.
 * See docs/MODULES.md#layers-and-dependency-direction.
 */

export { config, validateConfig } from './config.js';
export { logger } from './logger.js';
export { correlationMiddleware, getCorrelationId, withCorrelationId } from './correlation.js';
export { healthRouter } from './health.js';
export { clientErrorsRouter } from './clientErrors.js';
export { getSupabase, resetSupabase } from './supabase.js';
export {
  AppError, badRequest, validationFailed, unauthorized, forbidden, notFound, conflict,
  notFoundHandler, errorHandler,
} from './errors.js';
