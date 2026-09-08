/**
 * Configuration — the first thing loaded, before anything reads process.env.
 *
 * `dotenv.config()` runs at the top of this module and this module is imported first from
 * the entry point. ES module imports are hoisted and evaluated before the importing file's
 * body, so a `dotenv.config()` written below an `import` line runs TOO LATE — the imported
 * module has already read `undefined`. That is the bug that would have silently broken the
 * old `config/supabase.js`.
 *
 * Doc B §2: "Configuration lives in environment variables or a config service, never in
 * the repository."
 */

import 'dotenv/config';

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isProduction = NODE_ENV === 'production';

/** Parse a comma-separated list, dropping blanks. */
const list = (value) =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const int = (value, fallback) => {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  env: NODE_ENV,
  isProduction,

  port: int(process.env.PORT, 3000),

  /**
   * CORS allowlist. `cors()` with no arguments reflects ANY origin, which means any site
   * can call this API with a user's credentials. See docs/API.md#cors.
   */
  allowedOrigins: list(process.env.ALLOWED_ORIGINS).length
    ? list(process.env.ALLOWED_ORIGINS)
    : ['http://localhost:5173'],

  logLevel: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),

  /**
   * Rate limiting. Generous by default — the limit is there to stop abuse, not to police
   * a visitor browsing quickly. Lower it once there is real traffic to measure against.
   */
  rateLimit: {
    windowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: int(process.env.RATE_LIMIT_MAX, 1200),
    writeMax: int(process.env.RATE_LIMIT_WRITE_MAX, 5),
  },

  /**
   * Identifies what is actually running (Doc B §2: "so 'what is actually running' is never
   * guesswork"). These fall back to 'unknown' until CI injects them at build time — see
   * docs/runbooks/deployment.md.
   */
  build: {
    sha: process.env.GIT_SHA ?? 'unknown',
    version: process.env.APP_VERSION ?? '0.0.0',
    builtAt: process.env.BUILT_AT ?? null,
  },

  /** Feature flags, reported on the health endpoint per Doc B §2. */
  flags: Object.fromEntries(
    list(process.env.FEATURE_FLAGS).map((pair) => {
      const [name, value] = pair.split('=');
      return [name, value !== 'false'];
    }),
  ),

  supabase: {
    url: process.env.SUPABASE_URL ?? null,
    anonKey: process.env.SUPABASE_ANON_KEY ?? null,
  },
};

/**
 * Values the server cannot start without. Deliberately short: the platform module must boot
 * and serve /health with no database configured, so a misconfigured credential is diagnosed
 * by a running server rather than by a silent crash.
 *
 * Modules that genuinely need a value assert it themselves, at the point of use.
 */
const REQUIRED = [];

export function validateConfig() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const warnings = [];
  if (!config.supabase.url || !config.supabase.anonKey) {
    warnings.push('SUPABASE_URL / SUPABASE_ANON_KEY not set — database access is unavailable');
  }
  if (isProduction && config.allowedOrigins.some((o) => o.includes('localhost'))) {
    warnings.push('ALLOWED_ORIGINS contains localhost in production');
  }
  if (isProduction && config.build.sha === 'unknown') {
    warnings.push('GIT_SHA not set — cannot identify the running build');
  }
  return warnings;
}
