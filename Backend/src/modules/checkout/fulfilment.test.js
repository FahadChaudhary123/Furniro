import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { createCodCheckout, createCodFulfilment, createCodCancellation } from './index.js';

let db;
let advance;
const sql = (name, direction = 'up') => readFileSync(new URL(`../../../db/migrations/${name}.${direction}.sql`, import.meta.url), 'utf8');
const actorId = randomUUID();
async function order(reservationExpiresAt = new Date(Date.now() + 3600000).toISOString()) {
  return (await createCodCheckout(db)({ idempotencyKey: randomUUID(),
    quote: { currency: 'PKR', discountMinor: 0, shippingMinor: 0, taxMinor: 0,
      lines: [{ slug: 'test-chair', name: 'Synthetic chair', quantity: 2, unitPriceMinor: 1000 }] },
    delivery: { recipientName: 'Synthetic buyer', phone: '+92 300 0000000', addressLine1: 'Test street', city: 'Lahore', country: 'PK' },
    reservationExpiresAt })).orderId;
}
const state = async () => (await db.query('SELECT status FROM commerce.orders')).rows[0].status;
const stock = async () => (await db.query('SELECT on_hand, reserved FROM commerce.inventory_stock')).rows[0];
const move = (orderId, targetStatus) => advance({ orderId, targetStatus, actorId });

beforeAll(async () => {
  db = await PGlite.create();
  for (const name of ['0001_orders', '0002_payment_attempts', '0003_stock_reservations', '0004_order_delivery', '0005_order_events', '0006_cod_fulfilment_events']) {
    await db.exec(sql(name));
  }
  advance = createCodFulfilment(db);
}, 30000);
beforeEach(async () => {
  await db.exec(`TRUNCATE commerce.stock_reservation_events, commerce.stock_reservations,
    commerce.inventory_stock, commerce.payment_attempt_events, commerce.payment_attempts,
    commerce.order_events, commerce.order_delivery, commerce.order_items, commerce.orders;
    INSERT INTO commerce.inventory_stock(product_slug, on_hand) VALUES ('test-chair', 3)`);
});
afterAll(async () => { await db?.close(); });

it('allocates, despatches and delivers with one stock consumption and one event per step', async () => {
  const orderId = await order();
  for (const targetStatus of ['allocated', 'despatched', 'delivered']) {
    expect(await move(orderId, targetStatus)).toEqual({ orderId, status: targetStatus, replayed: false });
    expect(await move(orderId, targetStatus)).toEqual({ orderId, status: targetStatus, replayed: true });
    expect(await state()).toBe(targetStatus);
    expect(await stock()).toEqual(targetStatus === 'allocated' ? { on_hand: 3, reserved: 2 } : { on_hand: 1, reserved: 0 });
  }
  expect((await db.query('SELECT event_type, actor_id FROM commerce.order_events ORDER BY id')).rows)
    .toEqual(['cod_allocated', 'cod_despatched', 'cod_delivered'].map((event_type) => ({ event_type, actor_id: actorId })));
  expect((await db.query('SELECT status FROM commerce.stock_reservation_events ORDER BY id')).rows)
    .toEqual([{ status: 'active' }, { status: 'consumed' }]);
  expect((await db.query('SELECT * FROM commerce.payment_attempts')).rows).toHaveLength(0);
});

it('rejects skipped, reversed, cancelled and unsupported transitions', async () => {
  const orderId = await order();
  for (const targetStatus of ['despatched', 'delivered', 'paid', 'toString']) await expect(move(orderId, targetStatus)).rejects.toThrow();
  await createCodCancellation(db)({ orderId, actorId });
  await expect(move(orderId, 'allocated')).rejects.toThrow('transition');
  expect(await state()).toBe('cancelled');
});

it('rejects stale backward requests after despatch without repeating stock changes', async () => {
  const orderId = await order();
  await move(orderId, 'allocated');
  await move(orderId, 'despatched');
  await expect(move(orderId, 'allocated')).rejects.toThrow('transition');
  expect(await stock()).toEqual({ on_hand: 1, reserved: 0 });
});

it('rolls back state and event when reservation coverage is incomplete', async () => {
  const orderId = await order();
  await db.exec('TRUNCATE commerce.stock_reservation_events, commerce.stock_reservations');
  await expect(move(orderId, 'allocated')).rejects.toThrow('Incomplete');
  expect(await state()).toBe('on_hold');
  expect((await db.query('SELECT * FROM commerce.order_events')).rows).toHaveLength(0);
});

it('rolls back despatch when reserved stock was released', async () => {
  const orderId = await order();
  await move(orderId, 'allocated');
  await db.query("UPDATE commerce.stock_reservations SET status = 'released' WHERE order_id = $1", [orderId]);
  await expect(move(orderId, 'despatched')).rejects.toThrow('reconciliation');
  expect(await state()).toBe('allocated');
  expect(await stock()).toEqual({ on_hand: 3, reserved: 0 });
  expect((await db.query('SELECT event_type FROM commerce.order_events')).rows).toEqual([{ event_type: 'cod_allocated' }]);
});

it('requires audit history for state replay and progression', async () => {
  const orderId = await order();
  await db.query("UPDATE commerce.orders SET status = 'allocated' WHERE id = $1", [orderId]);
  await expect(move(orderId, 'allocated')).rejects.toThrow('reconciliation');
  await expect(move(orderId, 'despatched')).rejects.toThrow('reconciliation');
});

it('rejects expired holds without extending them or consuming stock', async () => {
  const orderId = await order(new Date(Date.now() + 2000).toISOString());
  await move(orderId, 'allocated');
  await db.query('SELECT pg_sleep(2.1)');
  await expect(move(orderId, 'allocated')).rejects.toThrow('reconciliation');
  await expect(move(orderId, 'despatched')).rejects.toThrow('reconciliation');
  expect(await state()).toBe('allocated');
  expect(await stock()).toEqual({ on_hand: 3, reserved: 2 });
  expect((await db.query('SELECT event_type FROM commerce.order_events')).rows).toEqual([{ event_type: 'cod_allocated' }]);
});

it('refuses to advance online orders through the COD operation', async () => {
  const orderId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.query(`INSERT INTO commerce.orders(id, idempotency_key, request_hash, payment_method, status, subtotal_minor, total_minor)
      VALUES ($1, $2, $3, 'online', 'on_hold', 1000, 1000)`, [orderId, randomUUID(), 'a'.repeat(64)]);
    await tx.query(`INSERT INTO commerce.order_items(order_id, line_number, product_slug, product_name, quantity, unit_price_minor)
      VALUES ($1, 1, 'test-chair', 'Synthetic chair', 1, 1000)`, [orderId]);
  });
  await expect(move(orderId, 'allocated')).rejects.toThrow('Only COD');
  expect(await state()).toBe('on_hold');
});

it('rejects invalid identities and unknown orders', async () => {
  await expect(advance({ orderId: randomUUID(), actorId: 'untrusted', targetStatus: 'allocated' })).rejects.toThrow('UUID');
  await expect(move(randomUUID(), 'allocated')).rejects.toThrow('not found');
});

it('guards rollback after fulfilment and reverses an unused migration', async () => {
  await db.exec(sql('0006_cod_fulfilment_events', 'down'));
  await db.exec(sql('0006_cod_fulfilment_events'));
  await move(await order(), 'allocated');
  await expect(db.exec(sql('0006_cod_fulfilment_events', 'down'))).rejects.toThrow('progressed');
  await db.exec('ROLLBACK');
});
