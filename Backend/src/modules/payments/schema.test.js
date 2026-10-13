import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const sql = (name, direction = 'up') => readFileSync(new URL(
  `../../../db/migrations/${name}.${direction}.sql`, import.meta.url,
), 'utf8');
let db;
async function order(method = 'online') {
  return db.transaction(async (tx) => {
    const { rows } = await tx.query(`INSERT INTO commerce.orders
      (idempotency_key, request_hash, payment_method, subtotal_minor, total_minor)
      VALUES ($1, $2, $3, 10000, 10000) RETURNING id`, [randomUUID(), 'a'.repeat(64), method]);
    await tx.query(`INSERT INTO commerce.order_items
      (order_id, line_number, product_slug, product_name, quantity, unit_price_minor)
      VALUES ($1, 1, 'test-chair', 'Synthetic chair', 1, 10000)`, [rows[0].id]);
    return rows[0].id;
  });
}
async function attempt(orderId, amount = 10000, key = randomUUID()) {
  return (await db.query(`INSERT INTO commerce.payment_attempts
    (order_id, amount_minor, provider, idempotency_key) VALUES ($1, $2, 'test', $3) RETURNING id`,
  [orderId, amount, key])).rows[0].id;
}
const setStatus = (id, status) => db.query('UPDATE commerce.payment_attempts SET status = $2 WHERE id = $1', [id, status]);

describe('payment attempt persistence', () => {
  beforeAll(async () => {
    db = await PGlite.create();
    await db.exec(sql('0001_orders'));
    await db.exec(sql('0002_payment_attempts'));
  }, 30000);
  beforeEach(async () => {
    await db.exec('TRUNCATE commerce.payment_attempt_events, commerce.payment_attempts, commerce.order_items, commerce.orders');
  });
  afterAll(async () => { await db?.close(); });

  it('binds online attempts to the exact order amount and records initial history', async () => {
    const orderId = await order();
    await expect(attempt(orderId, 9999)).rejects.toThrow('foreign key');
    await expect(attempt(await order('cod'))).rejects.toThrow('foreign key');
    await attempt(orderId);
    expect((await db.query('SELECT previous_status, status FROM commerce.payment_attempt_events')).rows)
      .toEqual([{ previous_status: null, status: 'created' }]);
  });

  it('blocks another charge after pending, uncertain or successful outcomes', async () => {
    const orderId = await order();
    const id = await attempt(orderId);
    for (const status of ['created', 'pending', 'unknown', 'succeeded']) {
      await setStatus(id, status);
      await expect(attempt(orderId)).rejects.toThrow('unique');
    }
    await expect(setStatus(id, 'failed')).rejects.toThrow('Invalid payment attempt transition');
    expect((await db.query('SELECT status FROM commerce.payment_attempt_events ORDER BY id')).rows
      .map((row) => row.status)).toEqual(['created', 'pending', 'unknown', 'succeeded']);
  });

  it('allows a fresh retry after a confirmed failure and preserves the failed attempt', async () => {
    const orderId = await order();
    const key = randomUUID();
    const first = await attempt(orderId, 10000, key);
    await setStatus(first, 'failed');
    await expect(attempt(orderId, 10000, key)).rejects.toThrow('unique');
    await attempt(orderId);
    expect((await db.query('SELECT * FROM commerce.payment_attempts')).rows).toHaveLength(2);
    await expect(setStatus(first, 'pending')).rejects.toThrow('Invalid payment attempt transition');
  });

  it('keeps references unique and immutable, and protects amount and history', async () => {
    const first = await attempt(await order());
    const second = await attempt(await order());
    await db.query("UPDATE commerce.payment_attempts SET provider_reference = 'test-ref' WHERE id = $1", [first]);
    await expect(db.query("UPDATE commerce.payment_attempts SET provider_reference = 'test-ref' WHERE id = $1", [second]))
      .rejects.toThrow('unique');
    await expect(db.query("UPDATE commerce.payment_attempts SET provider_reference = 'replacement' WHERE id = $1", [first]))
      .rejects.toThrow('immutable');
    await expect(db.query('UPDATE commerce.payment_attempts SET amount_minor = 1 WHERE id = $1', [first]))
      .rejects.toThrow('immutable');
    await expect(db.query('DELETE FROM commerce.payment_attempts WHERE id = $1', [first]))
      .rejects.toThrow('cannot be deleted');
    await expect(db.exec("UPDATE commerce.payment_attempt_events SET status = 'failed'"))
      .rejects.toThrow('immutable');
  });

  it('rolls back status and history together on transaction failure', async () => {
    const id = await attempt(await order());
    await expect(db.transaction(async (tx) => {
      await tx.query("UPDATE commerce.payment_attempts SET status = 'pending' WHERE id = $1", [id]);
      throw new Error('simulated failure');
    })).rejects.toThrow('simulated failure');
    expect((await db.query('SELECT status FROM commerce.payment_attempts')).rows).toEqual([{ status: 'created' }]);
    expect((await db.query('SELECT * FROM commerce.payment_attempt_events')).rows).toHaveLength(1);
  });

  it('denies reads to untrusted database roles', async () => {
    await attempt(await order());
    await db.exec(`CREATE ROLE payment_test_reader;
      GRANT USAGE ON SCHEMA commerce TO payment_test_reader;
      GRANT SELECT ON commerce.payment_attempts, commerce.payment_attempt_events TO payment_test_reader;
      SET ROLE payment_test_reader;`);
    try {
      expect((await db.query('SELECT * FROM commerce.payment_attempts')).rows).toEqual([]);
      expect((await db.query('SELECT * FROM commerce.payment_attempt_events')).rows).toEqual([]);
    } finally {
      await db.exec('RESET ROLE; DROP OWNED BY payment_test_reader; DROP ROLE payment_test_reader;');
    }
  });

  it('protects populated schemas from rollback', async () => {
    await attempt(await order());
    await expect(db.exec(sql('0002_payment_attempts', 'down'))).rejects.toThrow('while attempts or events exist');
    await db.exec('ROLLBACK');
    expect((await db.query('SELECT * FROM commerce.payment_attempts')).rows).toHaveLength(1);
  });

  it('reverses empty payment storage without deleting existing orders', async () => {
    const orderId = await order();
    await db.exec(sql('0002_payment_attempts', 'down'));
    expect((await db.query('SELECT * FROM commerce.orders')).rows).toHaveLength(1);
    await db.exec(sql('0002_payment_attempts'));
    await attempt(orderId);
  });
});
