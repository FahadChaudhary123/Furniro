import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createApp } from '../../app.js';
import { logger } from '../../platform/index.js';
import { createCodCheckout } from '../checkout/index.js';
import { operatorFixture } from '../../../test/helpers/operatorAuth.js';

let db, server, base, fixture;
beforeAll(async () => {
  db = await PGlite.create();
  for (const name of ['0001_orders', '0002_payment_attempts', '0003_stock_reservations', '0004_order_delivery',
    '0005_order_events', '0006_cod_fulfilment_events', '0007_cod_collections']) {
    await db.exec(readFileSync(new URL(`../../../db/migrations/${name}.up.sql`, import.meta.url), 'utf8'));
  }
}, 30000);
beforeEach(async () => {
  vi.spyOn(logger, 'info').mockImplementation(() => {});
  vi.spyOn(logger, 'warn').mockImplementation(() => {});
  vi.spyOn(logger, 'error').mockImplementation(() => {});
  await db.exec(`TRUNCATE commerce.cod_collections, commerce.stock_reservation_events,
    commerce.stock_reservations, commerce.inventory_stock, commerce.payment_attempt_events,
    commerce.payment_attempts, commerce.order_events, commerce.order_delivery, commerce.order_items, commerce.orders;
    INSERT INTO commerce.inventory_stock(product_slug, on_hand) VALUES ('test-chair', 20)`);
  fixture = operatorFixture();
});
afterEach(async () => {
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); server = null; }
  vi.restoreAllMocks();
});
afterAll(async () => { await db?.close(); });
async function start(options = {}) {
  server = createApp({ operatorAuth: fixture.settings, operatorFetch: fixture.fetchImpl, commerceDb: db, ...options }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api/operator`;
}
async function call(path, { token = fixture.token(), body } = {}) {
  return fetch(`${base}${path}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function order() {
  return (await createCodCheckout(db)({ idempotencyKey: randomUUID(),
    quote: { currency: 'PKR', discountMinor: 0, shippingMinor: 0, taxMinor: 0,
      lines: [{ slug: 'test-chair', name: 'Synthetic chair', quantity: 2, unitPriceMinor: 1000 }] },
    delivery: { recipientName: 'Synthetic buyer', phone: '+92 300 0000000', addressLine1: 'Test street', city: 'Lahore', country: 'PK' },
    reservationExpiresAt: new Date(Date.now() + 3600000).toISOString() })).orderId;
}

it('publishes only safe sign-in configuration without authentication', async () => {
  await start();
  const response = await call('/auth-config', { token: null });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({ enabled: true, url: fixture.url, publishable_key: fixture.settings.publishableKey });
  expect(fixture.calls).toEqual([]);
});

it('reads saved order details and restricts delivery to fulfilment operators', async () => {
  const orderId = await order();
  await start();
  const response = await call(`/orders/${orderId}`);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const result = await response.json();
  expect(result).toMatchObject({ order_id: orderId, currency: 'PKR', status: 'on_hold', total_minor: 2000,
    delivery: { recipient_name: 'Synthetic buyer', city: 'Lahore' },
    items: [{ product_name: 'Synthetic chair', quantity: 2, unit_price_minor: 1000, line_total_minor: 2000 }] });
  expect(result).not.toHaveProperty('request_hash');
  expect(result).not.toHaveProperty('idempotency_key');
  fixture.settings.access[fixture.actorId] = ['finance'];
  const finance = await (await call(`/orders/${orderId}`)).json();
  expect(finance.delivery).toBeNull();
  expect(JSON.stringify(finance)).not.toContain('Synthetic buyer');
  expect(finance.items).toEqual(result.items);
  expect(JSON.stringify(logger.info.mock.calls)).not.toContain(orderId);
});

it('protects order reads before lookup and rejects malformed or missing orders', async () => {
  await start();
  for (const [token, status] of [[null, 401], [fixture.token({ sub: randomUUID() }), 403], [fixture.token({ aal: 'aal1' }), 403]]) {
    expect((await call('/orders/not-an-id', { token })).status).toBe(status);
  }
  expect((await call('/orders/not-an-id')).status).toBe(400);
  expect((await call(`/orders/${randomUUID()}?include_delivery=true`)).status).toBe(400);
  expect((await call(`/orders/${randomUUID()}`)).status).toBe(404);
});

it('returns an unavailable read rather than an empty order when storage is absent', async () => {
  await start({ commerceDb: null });
  const response = await call(`/orders/${randomUUID()}`);
  expect(response.status).toBe(503);
  expect((await response.json()).error.code).toBe('COMMERCE_UNAVAILABLE');
});

it('redacts order read storage failures', async () => {
  await start({ commerceDb: { query: async () => { throw new Error('synthetic-private-read-detail'); } } });
  const response = await call(`/orders/${randomUUID()}`);
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('synthetic-private-read-detail');
  expect(JSON.stringify(logger.error.mock.calls)).not.toContain('synthetic-private-read-detail');
});

it('returns a minimal non-cacheable operator session after verified MFA', async () => {
  await start();
  const response = await call('/session');
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('vary')).toContain('Authorization');
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(await response.json()).toEqual({ operator_id: fixture.actorId, roles: ['finance', 'fulfilment'] });
});

it('rejects missing tokens, non-operators and non-MFA sessions before order access', async () => {
  await start();
  for (const [token, status] of [[null, 401], [fixture.token({ sub: randomUUID() }), 403], [fixture.token({ aal: 'aal1' }), 403]]) {
    const response = await call(`/orders/${randomUUID()}/cancel`, { token, body: {} });
    expect(response.status).toBe(status);
    const payload = await response.json();
    expect(payload.error.correlationId).toBeTruthy();
    if (status === 401) expect(response.headers.get('www-authenticate')).toBe('Bearer');
  }
  expect((await db.query('SELECT * FROM commerce.order_events')).rows).toHaveLength(0);
});

it('separates finance from fulfilment and rejects caller-supplied audit identities', async () => {
  const orderId = await order();
  fixture.settings.access[fixture.actorId] = ['finance'];
  await start();
  expect((await call(`/orders/${orderId}/cancel`, { body: {} })).status).toBe(403);
  fixture.settings.access[fixture.actorId] = ['fulfilment'];
  expect((await call(`/orders/${orderId}/collections`, { body: {} })).status).toBe(403);
  expect((await call(`/orders/${orderId}/cancel`, { body: { actor_id: randomUUID() } })).status).toBe(400);
  const response = await call(`/orders/${orderId}/cancel`, { body: {} });
  expect(response.status).toBe(200);
  expect((await db.query('SELECT actor_id FROM commerce.order_events')).rows).toEqual([{ actor_id: fixture.actorId }]);
  expect((await call(`/orders/${orderId}/cancel`, { body: {} })).status).toBe(200);
  expect(JSON.stringify(logger.info.mock.calls)).not.toContain(orderId);
  expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(orderId);
});

it('protects the full fulfilment and cash-collection sequence with verified audit identities', async () => {
  const orderId = await order();
  await start();
  for (const target_status of ['allocated', 'despatched', 'delivered']) {
    const response = await call(`/orders/${orderId}/fulfilment`, { body: { target_status } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ order_id: orderId, status: target_status });
  }
  const body = { amount_minor: 2000, receipt_reference: 'TEST-AUTH-1', idempotency_key: randomUUID() };
  const collected = await call(`/orders/${orderId}/collections`, { body });
  expect(collected.status).toBe(200);
  const result = await collected.json();
  expect(result.collection_id).toBeTruthy();
  expect(await (await call(`/orders/${orderId}/collections`, { body })).json()).toEqual({ ...result, replayed: true });
  expect((await db.query('SELECT actor_id FROM commerce.cod_collections')).rows).toEqual([{ actor_id: fixture.actorId }]);
});

it('returns safe validation and conflict responses', async () => {
  const orderId = await order();
  await start();
  expect((await call(`/orders/${orderId}/fulfilment`, { body: { target_status: 'paid' } })).status).toBe(400);
  expect((await call(`/orders/${randomUUID()}/cancel`, { body: {} })).status).toBe(404);
  const response = await call(`/orders/${orderId}/fulfilment`, { body: { target_status: 'delivered' } });
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('ORDER_CONFLICT');
});

it('fails closed when Auth is disabled or commerce storage is absent', async () => {
  await start({ commerceDb: null });
  expect((await call('/session')).status).toBe(200);
  expect((await call(`/orders/${randomUUID()}/cancel`, { body: {} })).status).toBe(503);
  fixture.settings.enabled = false;
  const response = await call('/session');
  expect(response.status).toBe(503);
  expect((await response.json()).error.code).toBe('OPERATOR_AUTH_UNAVAILABLE');
});

it('redacts storage errors instead of returning or logging credentials', async () => {
  await start({ commerceDb: { transaction: async () => { throw new Error('synthetic-private-db-detail'); } } });
  const response = await call(`/orders/${randomUUID()}/cancel`, { body: {} });
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('synthetic-private-db-detail');
  expect(JSON.stringify(logger.error.mock.calls)).not.toContain('synthetic-private-db-detail');
});
