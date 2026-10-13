import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const sql = (name, direction = 'up') => readFileSync(new URL(
  `../../../db/migrations/${name}.${direction}.sql`, import.meta.url,
), 'utf8');
let db;
async function order(lines = [['test-chair', 2]]) {
  return db.transaction(async (tx) => {
    const subtotal = lines.reduce((sum, [, quantity]) => sum + quantity * 1000, 0);
    const { rows } = await tx.query(`INSERT INTO commerce.orders
      (idempotency_key, request_hash, payment_method, subtotal_minor, total_minor)
      VALUES ($1, $2, 'cod', $3, $3) RETURNING id`, [randomUUID(), 'a'.repeat(64), subtotal]);
    for (const [index, [slug, quantity]] of lines.entries()) {
      await tx.query(`INSERT INTO commerce.order_items
        (order_id, line_number, product_slug, product_name, quantity, unit_price_minor)
        VALUES ($1, $2, $3, 'Synthetic item', $4, 1000)`, [rows[0].id, index + 1, slug, quantity]);
    }
    return rows[0].id;
  });
}
const reserve = (tx, id, suffix = '') => tx.query(`INSERT INTO commerce.stock_reservations
  (order_id, line_number, product_slug, quantity, expires_at)
  SELECT order_id, line_number, product_slug, quantity, clock_timestamp() + interval '1 hour'
  FROM commerce.order_items WHERE order_id = $1 ORDER BY product_slug ${suffix}`, [id]);
const status = (id, value) => db.query('UPDATE commerce.stock_reservations SET status = $2 WHERE order_id = $1', [id, value]);
const stock = async () => (await db.query("SELECT on_hand, reserved FROM commerce.inventory_stock WHERE product_slug = 'test-chair'")).rows[0];

describe('stock reservation persistence', () => {
  beforeAll(async () => {
    db = await PGlite.create();
    for (const name of ['0001_orders', '0002_payment_attempts', '0003_stock_reservations']) await db.exec(sql(name));
  }, 30000);
  beforeEach(async () => {
    await db.exec(`TRUNCATE commerce.stock_reservation_events, commerce.stock_reservations,
      commerce.inventory_stock, commerce.payment_attempt_events, commerce.payment_attempts,
      commerce.order_items, commerce.orders;
      INSERT INTO commerce.inventory_stock(product_slug, on_hand) VALUES ('test-chair', 3);`);
  });
  afterAll(async () => { await db?.close(); });

  it('reserves exact quantities and cannot oversell remaining stock', async () => {
    await reserve(db, await order());
    expect(await stock()).toEqual({ on_hand: 3, reserved: 2 });
    await expect(reserve(db, await order())).rejects.toThrow('Insufficient');
    expect(await stock()).toEqual({ on_hand: 3, reserved: 2 });
  });

  it('does not reserve twice when a duplicate insert is ignored', async () => {
    const id = await order();
    await reserve(db, id);
    await reserve(db, id, 'ON CONFLICT DO NOTHING');
    expect(await stock()).toEqual({ on_hand: 3, reserved: 2 });
    expect((await db.query('SELECT * FROM commerce.stock_reservation_events')).rows).toHaveLength(1);
  });

  it('releases or consumes stock once and preserves transition history', async () => {
    const released = await order();
    await reserve(db, released);
    await status(released, 'released');
    await status(released, 'released');
    expect(await stock()).toEqual({ on_hand: 3, reserved: 0 });
    await expect(status(released, 'active')).rejects.toThrow('Invalid reservation transition');
    const consumed = await order();
    await reserve(db, consumed);
    await status(consumed, 'consumed');
    await status(consumed, 'consumed');
    expect(await stock()).toEqual({ on_hand: 1, reserved: 0 });
    expect((await db.query('SELECT status FROM commerce.stock_reservation_events ORDER BY id')).rows
      .map((row) => row.status)).toEqual(['active', 'released', 'active', 'consumed']);
    await expect(status(consumed, 'released')).rejects.toThrow('Invalid reservation transition');
  });

  it('rolls back all lines when any product is unavailable', async () => {
    const id = await order([['test-chair', 2], ['test-table', 1]]);
    await expect(db.transaction((tx) => reserve(tx, id))).rejects.toThrow();
    expect(await stock()).toEqual({ on_hand: 3, reserved: 0 });
    expect((await db.query('SELECT * FROM commerce.stock_reservations')).rows).toHaveLength(0);
    expect((await db.query('SELECT * FROM commerce.stock_reservation_events')).rows).toHaveLength(0);
  });

  it('binds reservations to the order line and protects identity and history', async () => {
    const id = await order();
    await expect(db.query(`INSERT INTO commerce.stock_reservations
      (order_id, line_number, product_slug, quantity, expires_at)
      VALUES ($1, 1, 'test-chair', 1, now() + interval '1 hour')`, [id])).rejects.toThrow('foreign key');
    expect(await stock()).toEqual({ on_hand: 3, reserved: 0 });
    await reserve(db, id);
    await expect(db.query('UPDATE commerce.stock_reservations SET quantity = 1 WHERE order_id = $1', [id])).rejects.toThrow();
    await expect(db.query('DELETE FROM commerce.stock_reservations WHERE order_id = $1', [id])).rejects.toThrow();
    await expect(db.exec('DELETE FROM commerce.stock_reservation_events')).rejects.toThrow('immutable');
    await expect(db.exec("UPDATE commerce.inventory_stock SET on_hand = 1 WHERE product_slug = 'test-chair'"))
      .rejects.toThrow('check constraint');
    expect(await stock()).toEqual({ on_hand: 3, reserved: 2 });
  });

  it('keeps expired stock held until explicitly released and prevents consumption', async () => {
    const id = await order();
    await db.query(`INSERT INTO commerce.stock_reservations
      (order_id, line_number, product_slug, quantity, expires_at)
      VALUES ($1, 1, 'test-chair', 2, clock_timestamp() + interval '100 milliseconds')`, [id]);
    await db.query('SELECT pg_sleep(0.15)');
    await expect(status(id, 'consumed')).rejects.toThrow('Expired');
    expect(await stock()).toEqual({ on_hand: 3, reserved: 2 });
    await status(id, 'released');
    expect(await stock()).toEqual({ on_hand: 3, reserved: 0 });
  });

  it('denies untrusted reads even if table select is granted', async () => {
    await reserve(db, await order());
    await db.exec(`CREATE ROLE stock_test_reader;
      GRANT USAGE ON SCHEMA commerce TO stock_test_reader;
      GRANT SELECT ON commerce.inventory_stock, commerce.stock_reservations, commerce.stock_reservation_events TO stock_test_reader;
      SET ROLE stock_test_reader;`);
    try {
      for (const table of ['inventory_stock', 'stock_reservations', 'stock_reservation_events']) {
        expect((await db.query(`SELECT * FROM commerce.${table}`)).rows).toEqual([]);
      }
    } finally {
      await db.exec('RESET ROLE; DROP OWNED BY stock_test_reader; DROP ROLE stock_test_reader;');
    }
  });

  it('protects populated inventory from rollback and reverses an empty schema', async () => {
    await expect(db.exec(sql('0003_stock_reservations', 'down'))).rejects.toThrow('while stock or reservation records exist');
    await db.exec('ROLLBACK');
    expect(await stock()).toEqual({ on_hand: 3, reserved: 0 });
    await db.exec('TRUNCATE commerce.stock_reservation_events, commerce.stock_reservations, commerce.inventory_stock');
    await db.exec(sql('0003_stock_reservations', 'down'));
    await db.exec(sql('0003_stock_reservations'));
    expect((await db.query('SELECT * FROM commerce.inventory_stock')).rows).toEqual([]);
  });
});
