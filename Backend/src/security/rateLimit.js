/**
 * Rate limiting — `SEC-03`, and the control docs/API.md requires on every public write.
 *
 * Doc B §7 R11 handles card testing and coupon brute force by rate-limiting at the edge.
 * This is the origin-side equivalent: a WAF is not in place, and an API with no limit is a
 * free amplifier for anyone who wants one.
 *
 * The store is in-memory, so a limit is per-process. That is honest for one instance and
 * wrong the moment there are two — a shared store (Redis) is needed then, or the limit is
 * really N times what it says.
 */

import rateLimit from 'express-rate-limit';
import { config, logger, AppError } from '../platform/index.js';

/** Emit the documented error shape rather than express-rate-limit's default text. */
function limitReached(req, res, next, options) {
  logger.warn('rate limit exceeded', {
    method: req.method,
    path: req.path,
    limit: options.limit,
  });
  next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Please slow down.'));
}

export function createLimiter({ windowMs, limit, name }) {
  return rateLimit({
    windowMs,
    limit,
    // draft-7 emits `RateLimit` / `RateLimit-Policy`; the legacy X- headers are noise.
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: limitReached,
    // Platform probes must never be throttled — a rate-limited health check reads as an
    // outage and can trigger a restart loop.
    skip: (req) => req.path.startsWith('/health'),
    /**
     * No custom keyGenerator. The default already resolves the client address correctly
     * (`trust proxy` is set in app.js) AND groups IPv6 addresses by /64 subnet.
     *
     * An earlier version here used `(req) => req.ip`, which express-rate-limit rejects with
     * ERR_ERL_KEY_GEN_IPV6: a single IPv6 allocation hands out billions of addresses, so
     * keying on the full address lets one client appear as unlimited distinct ones and walk
     * straight through the limit. Overriding this bought nothing and broke it.
     */
    ...(name ? { requestPropertyName: name } : {}),
  });
}

/**
 * The general limit. Generous by design: it exists to stop abuse, not to police normal
 * browsing, and a storefront page can legitimately make several calls. Tune with
 * RATE_LIMIT_MAX once there is real traffic to measure.
 */
export const apiLimiter = createLimiter({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
});

/**
 * For public writes — the contact form is the first. Not mounted yet because no write
 * endpoint exists; docs/API.md#post-apicontact specifies ~5/hour when it does.
 */
export const writeLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: config.rateLimit.writeMax,
});
