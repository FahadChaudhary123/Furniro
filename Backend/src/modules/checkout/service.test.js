import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createCodCheckout } from './index.js';

let db;
let checkout;
const quote = () => ({ currency: 'PKR', discountMinor: 100, shippingMinor: 300, taxMinor: 200,
  lines: [{ slug: 'test-chair', name: 'Synthetic chair', quantity: 2, unitPriceMinor: 1000 }] });
const request = () => ({ idempotencyKey: randomUUID(), quote: quote(),
  reservationExpiresAt: new Date(Date.now() + 3600000).toISOString() });

describe('atomic COD checkout persistence', () => {
  beforeAll(async () => {
    db = await PGlite.create();
    for (const name of ['0001_orders', '0002_payment_attempts', '0003_stock_reservations']) {
      await db.exec(readFileSync(new URL(`../../../db/migrations/${name}.up.sql`, import.meta.url), 'utf8'));
    }
    checkout = createCodCheckout(db);
  }, 30000);
  beforeEach(async () => {
    await db.exec(`TRUNCATE commerce.stock_reservation_events, commerce.stock_reservations,
      commerce.inventory_stock, commerce.payment_attempt_events, commerce.payment_attempts,
      commerce.order_items, commerce.orders;
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
    for (const table of ['orders', 'order_items', 'stock_reservations', 'stock_reservation_events']) {
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
});
