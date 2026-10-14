import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createCodCheckout, createCodCancellation } from './index.js';

let db;
let checkout;
const quote = () => ({ currency: 'PKR', discountMinor: 100, shippingMinor: 300, taxMinor: 200,
  lines: [{ slug: 'test-chair', name: 'Synthetic chair', quantity: 2, unitPriceMinor: 1000 }] });
const request = () => ({ idempotencyKey: randomUUID(), quote: quote(),
  delivery: { recipientName: 'Synthetic buyer', phone: '+92 300 0000000', addressLine1: 'Test street', city: 'Lahore', country: 'PK' },
  reservationExpiresAt: new Date(Date.now() + 3600000).toISOString() });

describe('atomic COD checkout persistence', () => {
  beforeAll(async () => {
    db = await PGlite.create();
    for (const name of ['0001_orders', '0002_payment_attempts', '0003_stock_reservations', '0004_order_delivery', '0005_order_events']) {
      await db.exec(readFileSync(new URL(`../../../db/migrations/${name}.up.sql`, import.meta.url), 'utf8'));
    }
    checkout = createCodCheckout(db);
  }, 30000);
  beforeEach(async () => {
    await db.exec(`TRUNCATE commerce.stock_reservation_events, commerce.stock_reservations,
      commerce.inventory_stock, commerce.payment_attempt_events, commerce.payment_attempts,
      commerce.order_events, commerce.order_delivery, commerce.order_items, commerce.orders;
      INSERT INTO commerce.inventory_stock(product_slug, on_hand) VALUES ('test-chair', 3);`);
  });
  afterAll(async () => { await db?.close(); });

  it('stores server quote snapshots and reserves stock with a COD order on hold', async () => {
    const result = await checkout(request());
    expect(result.replayed).toBe(false);
    const row = (await db.query('SELECT * FROM commerce.orders WHERE id = $1', [result.orderId])).rows[0];
    expect(row).toMatchObject({ payment_method: 'cod', status: 'on_hold', subtotal_minor: 2000,
      discount_minor: 100, shipping_minor: 300, tax_minor: 200, total_minor: 2400 });
    expect((await db.query('SELECT reserved FROM commerce.inventory_stock')).rows[0].reserved).toBe(2);
    expect((await db.query('SELECT * FROM commerce.payment_attempts')).rows).toHaveLength(0);
  });

  it('replays a retry without reserving again or extending expiry', async () => {
    const input = request();
    const first = await checkout(input);
    const retry = await checkout({ ...input, reservationExpiresAt: new Date(Date.now() + 7200000).toISOString() });
    expect(retry).toEqual({ orderId: first.orderId, replayed: true });
    expect((await db.query('SELECT * FROM commerce.orders')).rows).toHaveLength(1);
    expect((await db.query('SELECT reserved FROM commerce.inventory_stock')).rows[0].reserved).toBe(2);
    expect((await db.query('SELECT * FROM commerce.stock_reservation_events')).rows).toHaveLength(1);
  });

  it('rejects reuse of an idempotency key with different quote details', async () => {
    const input = request();
    await checkout(input);
    await expect(checkout({ ...input, quote: { ...input.quote, shippingMinor: 500 } }))
      .rejects.toThrow('different order');
    expect((await db.query('SELECT total_minor FROM commerce.orders')).rows[0].total_minor).toBe(2400);
  });

  it('rolls back order, lines and earlier reservations if a later product has no stock', async () => {
    const input = request();
    input.quote.lines.push({ slug: 'test-table', name: 'Synthetic table', quantity: 1, unitPriceMinor: 2000 });
    await expect(checkout(input)).rejects.toThrow();
    for (const table of ['orders', 'order_delivery', 'order_items', 'stock_reservations', 'stock_reservation_events']) {
      expect((await db.query(`SELECT * FROM commerce.${table}`)).rows).toHaveLength(0);
    }
    expect((await db.query('SELECT reserved FROM commerce.inventory_stock')).rows[0].reserved).toBe(0);
    await db.exec("INSERT INTO commerce.inventory_stock(product_slug, on_hand) VALUES ('test-table', 1)");
    expect((await checkout(input)).replayed).toBe(false);
    input.quote.lines.reverse();
    expect((await checkout(input)).replayed).toBe(true);
  });

  it('rejects unsafe or unapproved quote shapes before persisting anything', async () => {
    for (const invalidQuote of [
      { ...quote(), currency: 'IDR' },
      { ...quote(), taxMinor: 0.1 },
      { ...quote(), discountMinor: 3000 },
      { ...quote(), lines: [] },
      { ...quote(), lines: [...quote().lines, ...quote().lines] },
      { ...quote(), lines: [{ ...quote().lines[0], unitPriceMinor: Number.MAX_SAFE_INTEGER }] },
    ]) await expect(checkout({ ...request(), quote: invalidQuote })).rejects.toThrow();
    expect((await db.query('SELECT * FROM commerce.orders')).rows).toHaveLength(0);
  });

  it('rolls back a new order when reservation expiry is in the past', async () => {
    await expect(checkout({ ...request(), reservationExpiresAt: '2020-01-01T00:00:00Z' })).rejects.toThrow('future expiry');
    expect((await db.query('SELECT * FROM commerce.orders')).rows).toHaveLength(0);
  });

  it('stores delivery atomically and rejects a changed address on retry', async () => {
    const input = request();
    await checkout(input);
    expect((await db.query('SELECT recipient_name, city, country FROM commerce.order_delivery')).rows)
      .toEqual([{ recipient_name: 'Synthetic buyer', city: 'Lahore', country: 'PK' }]);
    expect((await checkout({ ...input, delivery: { ...input.delivery, city: ' Lahore ' } })).replayed).toBe(true);
    await expect(checkout({ ...input, delivery: { ...input.delivery, city: 'Karachi' } })).rejects.toThrow('different order');
    expect((await db.query('SELECT * FROM commerce.order_delivery')).rows).toHaveLength(1);
  });

  it('requires valid delivery before creating an order', async () => {
    for (const delivery of [undefined, {}, { ...request().delivery, country: 'US' }]) {
      await expect(checkout({ ...request(), delivery })).rejects.toThrow();
    }
    expect((await db.query('SELECT * FROM commerce.orders')).rows).toHaveLength(0);
  });

  it('enables forced row security and grants no public delivery access', async () => {
    const row = (await db.query(`SELECT relrowsecurity, relforcerowsecurity,
      NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(relacl, acldefault('r', relowner))) WHERE grantee = 0) AS private
      FROM pg_class WHERE oid = 'commerce.order_delivery'::regclass`)).rows[0];
    expect(row).toEqual({ relrowsecurity: true, relforcerowsecurity: true, private: true });
    await checkout(request());
    await expect(db.exec("UPDATE commerce.order_delivery SET country = 'US'")).rejects.toThrow();
  });

  it('guards populated rollback and reverses an empty delivery migration', async () => {
    const down = readFileSync(new URL('../../../db/migrations/0004_order_delivery.down.sql', import.meta.url), 'utf8');
    await checkout(request());
    await expect(db.exec(down)).rejects.toThrow('delivery records exist');
    await db.exec('ROLLBACK');
    await db.exec('TRUNCATE commerce.order_delivery');
    await db.exec(down);
    await db.exec(readFileSync(new URL('../../../db/migrations/0004_order_delivery.up.sql', import.meta.url), 'utf8'));
  });

  it('cancels once, releases stock and preserves an immutable operator event', async () => {
    const { orderId } = await checkout(request());
    const actorId = randomUUID();
    const cancel = createCodCancellation(db);
    expect(await cancel({ orderId, actorId })).toEqual({ orderId, replayed: false });
    expect(await cancel({ orderId, actorId })).toEqual({ orderId, replayed: true });
    expect((await db.query('SELECT status FROM commerce.orders')).rows[0].status).toBe('cancelled');
    expect((await db.query('SELECT on_hand, reserved FROM commerce.inventory_stock')).rows[0]).toEqual({ on_hand: 3, reserved: 0 });
    expect((await db.query('SELECT actor_id, event_type FROM commerce.order_events')).rows).toEqual([{ actor_id: actorId, event_type: 'cod_cancelled' }]);
    expect((await db.query('SELECT status FROM commerce.stock_reservation_events ORDER BY id')).rows.map((r) => r.status)).toEqual(['active', 'released']);
    await expect(db.exec('DELETE FROM commerce.order_events')).rejects.toThrow('immutable');
    await expect(db.exec('UPDATE commerce.order_events SET actor_id = gen_random_uuid()')).rejects.toThrow('immutable');
  });

  it('rejects allocated or unknown orders and invalid actors', async () => {
    const { orderId } = await checkout(request());
    const cancel = createCodCancellation(db);
    await expect(cancel({ orderId, actorId: 'browser-name' })).rejects.toThrow('UUID');
    await expect(cancel({ orderId: randomUUID(), actorId: randomUUID() })).rejects.toThrow('not found');
    await db.query("UPDATE commerce.orders SET status = 'allocated' WHERE id = $1", [orderId]);
    await expect(cancel({ orderId, actorId: randomUUID() })).rejects.toThrow('on-hold');
    expect((await db.query('SELECT * FROM commerce.order_events')).rows).toHaveLength(0);
    expect((await db.query('SELECT reserved FROM commerce.inventory_stock')).rows[0].reserved).toBe(2);
  });

  it('rolls back cancellation and its event if stock was consumed', async () => {
    const { orderId } = await checkout(request());
    await db.query("UPDATE commerce.stock_reservations SET status = 'consumed' WHERE order_id = $1", [orderId]);
    await expect(createCodCancellation(db)({ orderId, actorId: randomUUID() })).rejects.toThrow('reconciliation');
    expect((await db.query('SELECT status FROM commerce.orders')).rows[0].status).toBe('on_hold');
    expect((await db.query('SELECT * FROM commerce.order_events')).rows).toHaveLength(0);
  });

  it('requires reconciliation for cancelled orders without an audit event', async () => {
    const { orderId } = await checkout(request());
    await db.query("UPDATE commerce.orders SET status = 'cancelled' WHERE id = $1", [orderId]);
    await expect(createCodCancellation(db)({ orderId, actorId: randomUUID() })).rejects.toThrow('reconciliation');
  });

  it('guards event rollback and enables private row security', async () => {
    const row = (await db.query(`SELECT relrowsecurity, relforcerowsecurity,
      NOT EXISTS (SELECT 1 FROM aclexplode(COALESCE(relacl, acldefault('r', relowner))) WHERE grantee = 0) AS private
      FROM pg_class WHERE oid = 'commerce.order_events'::regclass`)).rows[0];
    expect(row).toEqual({ relrowsecurity: true, relforcerowsecurity: true, private: true });
    const { orderId } = await checkout(request());
    await createCodCancellation(db)({ orderId, actorId: randomUUID() });
    const down = readFileSync(new URL('../../../db/migrations/0005_order_events.down.sql', import.meta.url), 'utf8');
    await expect(db.exec(down)).rejects.toThrow('records exist');
    await db.exec('ROLLBACK');
    await db.exec('TRUNCATE commerce.order_events');
    await db.exec(down);
    await db.exec(readFileSync(new URL('../../../db/migrations/0005_order_events.up.sql', import.meta.url), 'utf8'));
  });
});
