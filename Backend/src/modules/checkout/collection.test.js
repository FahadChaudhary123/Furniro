import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';
import { createCodCheckout, createCodFulfilment, createCodCollection } from './index.js';

let db;
let collect;
const actorId = randomUUID();
const sql = (name, direction = 'up') => readFileSync(new URL(`../../../db/migrations/${name}.${direction}.sql`, import.meta.url), 'utf8');
const request = (orderId) => ({ orderId, actorId, idempotencyKey: randomUUID(), amountMinor: 2000, receiptReference: 'TEST-RECEIPT-1' });
async function order(deliver = true) {
  const { orderId } = await createCodCheckout(db)({ idempotencyKey: randomUUID(),
    quote: { currency: 'PKR', discountMinor: 0, shippingMinor: 0, taxMinor: 0,
      lines: [{ slug: 'test-chair', name: 'Synthetic chair', quantity: 2, unitPriceMinor: 1000 }] },
    delivery: { recipientName: 'Synthetic buyer', phone: '+92 300 0000000', addressLine1: 'Test street', city: 'Lahore', country: 'PK' },
    reservationExpiresAt: new Date(Date.now() + 3600000).toISOString() });
  if (deliver) for (const targetStatus of ['allocated', 'despatched', 'delivered']) {
    await createCodFulfilment(db)({ orderId, actorId, targetStatus });
  }
  return orderId;
}
beforeAll(async () => {
  db = await PGlite.create();
  for (const name of ['0001_orders', '0002_payment_attempts', '0003_stock_reservations', '0004_order_delivery',
    '0005_order_events', '0006_cod_fulfilment_events', '0007_cod_collections']) await db.exec(sql(name));
  collect = createCodCollection(db);
}, 30000);
beforeEach(async () => {
  await db.exec(`TRUNCATE commerce.cod_collections, commerce.stock_reservation_events,
    commerce.stock_reservations, commerce.inventory_stock, commerce.payment_attempt_events,
    commerce.payment_attempts, commerce.order_events, commerce.order_delivery, commerce.order_items, commerce.orders;
    INSERT INTO commerce.inventory_stock(product_slug, on_hand) VALUES ('test-chair', 20)`);
});
afterAll(async () => { await db?.close(); });

it('records exact cash collection once and preserves the original operator on retry', async () => {
  const input = request(await order());
  expect((await db.query('SELECT * FROM commerce.cod_collections')).rows).toHaveLength(0);
  const result = await collect(input);
  expect(result).toMatchObject({ orderId: input.orderId, replayed: false });
  expect(await collect({ ...input, orderId: input.orderId.toUpperCase(), actorId: randomUUID(),
    receiptReference: input.receiptReference.toLowerCase() })).toEqual({ ...result, replayed: true });
  const rows = (await db.query('SELECT amount_minor, currency, payment_method, actor_id, receipt_reference FROM commerce.cod_collections')).rows;
  expect(rows).toEqual([{ amount_minor: 2000, currency: 'PKR', payment_method: 'cod', actor_id: actorId, receipt_reference: input.receiptReference }]);
  expect((await db.query('SELECT status FROM commerce.orders')).rows[0].status).toBe('delivered');
  expect((await db.query('SELECT on_hand, reserved FROM commerce.inventory_stock')).rows[0]).toEqual({ on_hand: 18, reserved: 0 });
  expect((await db.query('SELECT * FROM commerce.payment_attempts')).rows).toHaveLength(0);
});

it('rejects partial, excessive, fractional and invalid amounts', async () => {
  const input = request(await order());
  for (const amountMinor of [0, -1, 1999, 2001, 1.5, '2000', Number.MAX_SAFE_INTEGER + 1]) {
    await expect(collect({ ...input, amountMinor })).rejects.toThrow();
  }
  expect((await db.query('SELECT * FROM commerce.cod_collections')).rows).toHaveLength(0);
});

it('rejects duplicate orders, receipt reuse and conflicting retry keys', async () => {
  const first = request(await order());
  await collect(first);
  await expect(collect({ ...first, idempotencyKey: randomUUID() })).rejects.toThrow('conflicts');
  await expect(collect({ ...first, receiptReference: 'DIFFERENT' })).rejects.toThrow('conflicts');
  const second = request(await order());
  await expect(collect(second)).rejects.toThrow('conflicts');
  await expect(collect({ ...second, idempotencyKey: first.idempotencyKey, receiptReference: 'SECOND' })).rejects.toThrow('conflicts');
  expect((await db.query('SELECT * FROM commerce.cod_collections')).rows).toHaveLength(1);
});

it('requires delivered state, delivery history and consumed stock', async () => {
  const orderId = await order(false);
  await expect(collect(request(orderId))).rejects.toThrow('delivered COD');
  await db.query("UPDATE commerce.orders SET status = 'delivered' WHERE id = $1", [orderId]);
  await expect(collect(request(orderId))).rejects.toThrow('history');
  await db.query("INSERT INTO commerce.order_events(order_id, event_type, actor_id) VALUES ($1, 'cod_delivered', $2)", [orderId, actorId]);
  await expect(collect(request(orderId))).rejects.toThrow('stock');
  expect((await db.query('SELECT * FROM commerce.cod_collections')).rows).toHaveLength(0);
});

it('rejects missing orders, bad identities and invalid receipt codes', async () => {
  await expect(collect(request(randomUUID()))).rejects.toThrow('not found');
  const input = request(await order());
  for (const changes of [{ actorId: 'untrusted' }, { idempotencyKey: '' }, { receiptReference: '' },
    { receiptReference: 'private\nvalue' }, { receiptReference: 'X'.repeat(101) }]) {
    await expect(collect({ ...input, ...changes })).rejects.toThrow();
  }
});

it('enforces exact order amount and immutable collection history at the database', async () => {
  const orderId = await order();
  await expect(db.query(`INSERT INTO commerce.cod_collections(order_id, amount_minor, idempotency_key, receipt_reference, actor_id)
    VALUES ($1, 1000, $2, 'DIRECT', $3)`, [orderId, randomUUID(), actorId])).rejects.toThrow('foreign key');
  await collect(request(orderId));
  await expect(db.exec('DELETE FROM commerce.cod_collections')).rejects.toThrow('immutable');
  await expect(db.exec("UPDATE commerce.cod_collections SET receipt_reference = 'EDITED'")).rejects.toThrow('immutable');
});

it('refuses online orders both through the service and the database collection binding', async () => {
  const orderId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.query(`INSERT INTO commerce.orders(id, idempotency_key, request_hash, payment_method, status, subtotal_minor, total_minor)
      VALUES ($1, $2, $3, 'online', 'delivered', 2000, 2000)`, [orderId, randomUUID(), 'a'.repeat(64)]);
    await tx.query(`INSERT INTO commerce.order_items(order_id, line_number, product_slug, product_name, quantity, unit_price_minor)
      VALUES ($1, 1, 'test-chair', 'Synthetic chair', 2, 1000)`, [orderId]);
  });
  await expect(collect(request(orderId))).rejects.toThrow('delivered COD');
  await expect(db.query(`INSERT INTO commerce.cod_collections(order_id, amount_minor, idempotency_key, receipt_reference, actor_id)
    VALUES ($1, 2000, $2, 'ONLINE', $3)`, [orderId, randomUUID(), actorId])).rejects.toThrow('foreign key');
});

it('denies untrusted collection reads even with a select grant', async () => {
  await collect(request(await order()));
  await db.exec(`CREATE ROLE collection_test_reader; GRANT USAGE ON SCHEMA commerce TO collection_test_reader;
    GRANT SELECT ON commerce.cod_collections TO collection_test_reader; SET ROLE collection_test_reader;`);
  try {
    expect((await db.query('SELECT * FROM commerce.cod_collections')).rows).toHaveLength(0);
  } finally {
    await db.exec('RESET ROLE; DROP OWNED BY collection_test_reader; DROP ROLE collection_test_reader;');
  }
});

it('reverses an empty migration and refuses to discard collection history', async () => {
  await db.exec(sql('0007_cod_collections', 'down'));
  await db.exec(sql('0007_cod_collections'));
  await collect(request(await order()));
  await expect(db.exec(sql('0007_cod_collections', 'down'))).rejects.toThrow('records exist');
  await db.exec('ROLLBACK');
});
