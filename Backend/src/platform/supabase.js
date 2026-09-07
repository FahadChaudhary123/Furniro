/**
 * Supabase client — the shared connection, constructed once, lazily.
 *
 * Replaces the old `Backend/config/supabase.js`, which constructed the client at import
 * time from `process.env` values that nothing had loaded yet — both would have been
 * `undefined`. Constructing lazily means the server boots and serves /health without
 * credentials, and fails loudly at the point of use instead.
 *
 * Per docs/MODULES.md#boundary-rules, only a module's `repository.js` may import this.
 * Controllers go through their module's service; they never touch the client directly.
 *
 * The anon key is public by design and is safe ONLY with row-level security enabled on
 * every table. See docs/SECURITY.md#2-know-what-the-anon-key-is.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

let client = null;

export function getSupabase() {
  if (client) return client;

  const { url, anonKey } = config.supabase;
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in Backend/.env ' +
        '(copy .env.example). See docs/runbooks/local-development.md.',
    );
  }

  client = createClient(url, anonKey);
  return client;
}

/** Test seam: drop the memoised client. */
export const resetSupabase = () => {
  client = null;
};
