import { createClient } from '@supabase/supabase-js';
import { AppError } from '../../platform/index.js';

const uuid = (value) => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const unavailable = () => new AppError(503, 'OPERATOR_AUTH_UNAVAILABLE', 'Operator authentication is unavailable.');
const unauthorized = () => new AppError(401, 'UNAUTHORIZED', 'A valid operator access token is required.');

function settingsFor(input) {
  try {
    if (!input?.enabled || !input.publishableKey?.startsWith('sb_publishable_')) throw unavailable();
    const url = new URL(input.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw unavailable();
    const access = typeof input.access === 'string' ? JSON.parse(input.access) : input.access;
    if (!access || typeof access !== 'object' || Array.isArray(access)) throw unavailable();
    const roles = new Map();
    for (const [id, values] of Object.entries(access)) {
      if (!uuid(id) || roles.has(id.toLowerCase()) || !Array.isArray(values) || !values.length ||
          values.some((role) => !['fulfilment', 'finance'].includes(role))) throw unavailable();
      roles.set(id.toLowerCase(), Object.freeze([...new Set(values)].sort()));
    }
    return { url: url.origin, key: input.publishableKey, roles };
  } catch { throw unavailable(); }
}

function checkProviderError(error) {
  if (!error) return;
  if ([400, 401, 403, 422].includes(error.status) || error.name === 'AuthInvalidJwtError') throw unauthorized();
  throw unavailable();
}

/** Verify signatures and current user with Supabase; never authorize from user metadata. */
export function createOperatorAuthenticator(settings, { fetchImpl = globalThis.fetch } = {}) {
  return async (authorization) => {
    if (typeof authorization !== 'string' || authorization.length > 8192 ||
        !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/i.test(authorization)) throw unauthorized();
    const options = settingsFor(settings);
    const token = authorization.slice(7);
    // Shape checks only reject input; only the SDK's signature verification grants trust.
    try {
      const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
      if (!['ES256', 'RS256', 'HS256'].includes(header?.alg) || !payload || typeof payload !== 'object' || Array.isArray(payload)) throw unauthorized();
    } catch { throw unauthorized(); }
    const client = createClient(options.url, options.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: async (url, init = {}) => {
        try {
          return await fetchImpl(url, { ...init,
            signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000),
          });
        } catch {
          // The Auth SDK logs thrown fetch errors. Replace transport details before it can.
          return new Response('{"msg":"Authentication transport unavailable"}', {
            status: 503, headers: { 'content-type': 'application/json' },
          });
        }
      } },
    });
    try {
      // Verify the signature first, then explicitly enforce expiry/issuer/audience below.
      const claimResult = await client.auth.getClaims(token, { allowExpired: true });
      checkProviderError(claimResult.error);
      const claims = claimResult.data?.claims;
      const now = Math.floor(Date.now() / 1000);
      if (!claims || !uuid(claims.sub) || claims.iss !== `${options.url}/auth/v1` || claims.aud !== 'authenticated' ||
          claims.role !== 'authenticated' || !Number.isSafeInteger(claims.exp) || claims.exp <= now ||
          (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > now))) throw unauthorized();
      const userResult = await client.auth.getUser(token);
      checkProviderError(userResult.error);
      const user = userResult.data?.user;
      if (!user || user.id !== claims.sub || user.is_anonymous || claims.is_anonymous) throw unauthorized();
      const roles = options.roles.get(user.id.toLowerCase());
      if (!roles) throw new AppError(403, 'FORBIDDEN', 'Operator access is not assigned.');
      if (claims.aal !== 'aal2') throw new AppError(403, 'MFA_REQUIRED', 'Multi-factor authentication is required.');
      return Object.freeze({ id: user.id.toLowerCase(), roles });
    } catch (error) {
      if (error instanceof AppError) throw error;
      // Provider errors can contain token/URL context. Never forward or log their text.
      throw unavailable();
    }
  };
}
