import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const migration = (direction) => readFileSync(new URL(
  `../../../db/migrations/0001_orders.${direction}.sql`, import.meta.url,
), 'utf8');
let db;

// Synthetic values only. No .env import, external connection or catalogue copy.
async function insertOrder(tx, { key = randomUUID(), subtotal = 25000, total = 25000 } = {}) {
  const { rows } = await tx.query(`INSERT INTO commerce.orders
    (idempotency_key, request_hash, payment_method, subtotal_minor, total_minor)
    VALUES ($1, $2, 'cod', $3, $4) RETURNING id`, [key, 'a'.repeat(64), subtotal, total]);
  return rows[0].id;
}
async function insertLine(tx, id, price = 12500) {
  await tx.query(`INSERT INTO commerce.order_items
    (order_id, line_number, product_slug, product_name, quantity, unit_price_minor)
    VALUES ($1, 1, 'test-chair', 'Synthetic test chair', 2, $2)`, [id, price]);
}
async function placeOrder(options) {
  return db.transaction(async (tx) => {
    const id = await insertOrder(tx, options);
    await insertLine(tx, id);
    return id;
  });
}

describe('order schema on PostgreSQL', () => {
  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec(migration('up'));
  }, 30000);
  beforeEach(async () => {
    await db.exec('TRUNCATE commerce.order_items, commerce.orders');
  });
  afterAll(async () => { await db?.close(); });

  it('commits an order and calculated item snapshots atomically', async () => {
    const id = await placeOrder();
    const { rows } = await db.query(`SELECT o.currency, o.total_minor, i.line_total_minor
      FROM commerce.orders o JOIN commerce.order_items i ON i.order_id = o.id WHERE o.id = $1`, [id]);
    expect(rows).toEqual([{ currency: 'PKR', total_minor: 25000, line_total_minor: 25000 }]);
  });

  it('rejects an empty order at commit and rolls back the transaction', async () => {
    await expect(db.transaction((tx) => insertOrder(tx))).rejects.toThrow('subtotal');
    expect((await db.query('SELECT * FROM commerce.orders')).rows).toEqual([]);
  });

  it('rejects mismatched line and order amounts at commit', async () => {
    await expect(db.transaction(async (tx) => {
      const id = await insertOrder(tx);
      await insertLine(tx, id, 12499);
    })).rejects.toThrow('subtotal');
    expect((await db.query('SELECT * FROM commerce.order_items')).rows).toEqual([]);
    expect((await db.query('SELECT * FROM commerce.orders')).rows).toEqual([]);
  });

  it('prevents duplicate idempotency keys from creating a second order', async () => {
    const key = randomUUID();
    await placeOrder({ key });
    await expect(placeOrder({ key })).rejects.toThrow('unique');
    expect((await db.query('SELECT * FROM commerce.orders')).rows).toHaveLength(1);
  });

  it('rejects totals inconsistent with the order components', async () => {
    await expect(placeOrder({ total: 25001 })).rejects.toThrow('check constraint');
  });

  it('protects historical snapshots from later changes', async () => {
    const id = await placeOrder();
    await expect(db.query('UPDATE commerce.order_items SET unit_price_minor = 13000 WHERE order_id = $1', [id]))
      .rejects.toThrow('immutable');
    await expect(db.query('DELETE FROM commerce.order_items WHERE order_id = $1', [id]))
      .rejects.toThrow('immutable');
    await expect(db.query('UPDATE commerce.orders SET subtotal_minor = 26000, total_minor = 26000 WHERE id = $1', [id]))
      .rejects.toThrow('immutable');
  });

  it('rejects invalid currency and unsafe monetary integers', async () => {
    await expect(db.transaction(async (tx) => {
      await tx.query(`INSERT INTO commerce.orders
        (idempotency_key, request_hash, payment_method, currency, subtotal_minor, total_minor)
        VALUES ($1, $2, 'cod', 'IDR', 1, 1)`, [randomUUID(), 'a'.repeat(64)]);
    })).rejects.toThrow('check constraint');
    await expect(placeOrder({ subtotal: '9007199254740992', total: '9007199254740992' }))
      .rejects.toThrow('check constraint');
  });

  it('keeps orders inaccessible to an untrusted role even if table read is granted', async () => {
    await placeOrder();
    await db.exec(`CREATE ROLE order_test_reader;
      GRANT USAGE ON SCHEMA commerce TO order_test_reader;
      GRANT SELECT ON commerce.orders, commerce.order_items TO order_test_reader;
      SET ROLE order_test_reader;`);
    try {
      expect((await db.query('SELECT * FROM commerce.orders')).rows).toEqual([]);
      expect((await db.query('SELECT * FROM commerce.order_items')).rows).toEqual([]);
    } finally {
      await db.exec('RESET ROLE; DROP OWNED BY order_test_reader; DROP ROLE order_test_reader;');
    }
  });

  it('refuses rollback when orders exist', async () => {
    await placeOrder();
    await expect(db.exec(migration('down'))).rejects.toThrow('while orders exist');
    await db.exec('ROLLBACK');
    expect((await db.query('SELECT * FROM commerce.orders')).rows).toHaveLength(1);
  });

  it('rolls an empty schema back and reapplies the migration', async () => {
    await db.exec(migration('down'));
    expect((await db.query("SELECT to_regclass('commerce.orders') AS name")).rows[0].name).toBeNull();
    await db.exec(migration('up'));
    await placeOrder();
    expect((await db.query('SELECT version FROM commerce.schema_migrations')).rows[0].version).toBe('0001_orders');
  });
});
