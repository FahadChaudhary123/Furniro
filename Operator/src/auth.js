import { createClient } from '@supabase/supabase-js';

const api = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');
export async function loadClient() {
  const response = await fetch(`${api}/operator/auth-config`, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Sign-in is unavailable. Please try again.');
  const config = await response.json();
  if (!config.enabled) return null;
  const url = new URL(config.url);
  if (url.protocol !== 'https:' || url.username || url.password || !config.publishable_key?.startsWith('sb_publishable_')) throw new Error('Sign-in configuration is invalid.');
  return createClient(url.origin, config.publishable_key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init = {}) => {
      try { return await fetch(input, { ...init, signal: AbortSignal.timeout(10000) }); }
      catch { return new Response('{"msg":"Authentication unavailable"}', { status: 503, headers: { 'content-type': 'application/json' } }); }
    } },
  });
}

export async function verifyAccess(client) {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) throw new Error('Your session ended. Sign out and sign in again.');
  const response = await fetch(`${api}/operator/session`, {
    headers: { Authorization: `Bearer ${data.session.access_token}` }, credentials: 'omit',
    cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(response.status === 403
    ? 'Operator access was denied. Ask the account owner to check your roles and MFA.'
    : 'Access could not be verified. Please try again or sign out.');
  return { ...await response.json(), expiresAt: data.session.expires_at * 1000 };
}

export async function loadOrder(client, orderId, signal) {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) throw new Error('Your session ended. Sign out and sign in again.');
  let response;
  try {
    response = await fetch(`${api}/operator/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` }, credentials: 'omit',
      cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    });
  } catch { throw new Error('The order could not be loaded. Check your connection and retry.'); }
  if (!response.ok) {
    const messages = {
      400: 'Enter a valid order ID.', 401: 'Your session ended. Sign out and sign in again.',
      403: 'Access denied. Ask the account owner to check your roles.',
      404: 'No order was found with that ID.',
      429: 'Too many requests. Wait a minute and retry.',
      503: 'Order lookup is unavailable. Commerce storage or authentication may not be configured.',
    };
    throw new Error(messages[response.status] || 'The order could not be loaded. Please retry.');
  }
  return response.json();
}

export async function changeOrder(client, orderId, target, signal) {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) throw new Error('Your session ended. Sign out and sign in again.');
  let response;
  try {
    response = await fetch(`${api}/operator/orders/${encodeURIComponent(orderId)}/${target === 'cancelled' ? 'cancel' : 'fulfilment'}`, {
      method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      credentials: 'omit', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      body: JSON.stringify(target === 'cancelled' ? {} : { target_status: target }),
    });
  } catch { throw new Error('The outcome is unknown. Find the order again before attempting another action.'); }
  if (!response.ok) {
    const messages = {
      401: 'Your session ended. Sign out and sign in again.',
      403: 'Access denied. Ask the account owner to check your roles.',
      409: 'The order changed or cannot make this transition. Find the order again to review its current state.',
      404: 'No order was found with that ID.',
      429: 'Too many requests. Wait before looking up the order again.',
    };
    throw new Error(messages[response.status] || 'The action could not be confirmed. Find the order again before retrying.');
  }
}

export async function collectCod(client, orderId, payload, signal) {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) throw new Error('Your session ended. Sign out and sign in again.');
  const uncertain = () => Object.assign(new Error('The collection outcome is unconfirmed. Retry the same collection to check or complete this submission.'), { retryable: true });
  let response;
  try {
    response = await fetch(`${api}/operator/orders/${encodeURIComponent(orderId)}/collections`, {
      method: 'POST', headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' },
      credentials: 'omit', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      body: JSON.stringify(payload),
    });
  } catch { throw uncertain(); }
  if (!response.ok) {
    const messages = {
      400: 'Collection details were rejected. Look up the order again and check the receipt.',
      401: 'Your session ended. Sign out and sign in again.',
      403: 'Access denied. Ask the account owner to check your finance role.',
      404: 'No order was found with that ID.',
      409: 'Collection conflicts with an existing record or order state. Reconcile the receipt with finance before submitting again.',
      429: 'Too many requests. Wait before retrying the same collection.',
    };
    if (!messages[response.status]) throw uncertain();
    throw Object.assign(new Error(messages[response.status]), { retryable: response.status === 429 });
  }
  let result;
  try { result = await response.json(); } catch { throw uncertain(); }
  if (result?.order_id !== orderId || typeof result.replayed !== 'boolean' ||
      typeof result.collection_id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(result.collection_id)) throw uncertain();
  return result;
}
