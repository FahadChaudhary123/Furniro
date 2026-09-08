/**
 * Security module — public interface. Layer 0; depends only on `platform`.
 * See docs/MODULES.md#layers-and-dependency-direction.
 *
 * Owns SEC-01..SEC-06. Built here: SEC-03 (rate limiting) and SEC-04 (headers).
 * SEC-05/SEC-06 (dependency and secret scanning) live in CI.
 * SEC-01 (managed secret store) and SEC-02 (WAF) need infrastructure that does not exist.
 */

export { securityHeaders } from './headers.js';
export { apiLimiter, writeLimiter, clientErrorLimiter, createLimiter } from './rateLimit.js';
