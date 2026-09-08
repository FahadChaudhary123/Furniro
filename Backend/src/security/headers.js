/**
 * Security headers — `SEC-04`.
 *
 * Doc B §10 asks for a quarterly audit of "CSP, HSTS, frame and referrer policies; modern
 * cipher suites only". The API sent none of them before this.
 *
 * Most of these matter more on the HTML host than on a JSON API, but they cost nothing and
 * an API that ever returns an error page, a redirect, or a file is one that wanted them.
 * The front end needs its own set from whatever serves the bundle — see
 * docs/SECURITY.md#transport-and-headers.
 */

import helmet from 'helmet';
import { config } from '../platform/index.js';

export function securityHeaders() {
  return helmet({
    /**
     * This API returns JSON and nothing else, so it needs no sources of any kind. If it
     * ever serves HTML, this is already the right starting point to loosen deliberately
     * rather than a policy to invent under pressure.
     */
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'none'"],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'none'"],
      },
    },

    /**
     * MUST be cross-origin. Helmet defaults this to `same-origin`, which would block the
     * storefront from reading its own API — the CORS headers would be correct and the
     * browser would refuse the response anyway. A silent, confusing failure.
     */
    crossOriginResourcePolicy: { policy: 'cross-origin' },

    /**
     * HSTS is only honoured over HTTPS, so it is inert locally. Enabled in production only,
     * because `includeSubDomains` on a domain you do not fully control is hard to undo —
     * browsers cache it for the full max-age.
     */
    hsts: config.isProduction
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
      : false,

    referrerPolicy: { policy: 'no-referrer' },
    frameguard: { action: 'deny' },
    // X-Powered-By is already off in app.js; helmet would remove it too.
  });
}
