// Disposable Docker PostgreSQL only. Never reads .env or any connection URL.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { createCommerceDatabase } from '../src/platform/commerceDatabase.js';
import { createCodCheckout, createCodFulfilment, createCodCancellation, createCodCollection } from '../src/modules/checkout/index.js';
import { readOperatorOrder } from '../src/modules/orders/index.js';

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 180000 }).trim();
const name = `furniro-commerce-${randomUUID()}`;
let pool;
let attempted = false;
const actorId = randomUUID();
const input = () => ({ idempotencyKey: randomUUID(),
  quote: { currency: 'PKR', discountMinor: 0, shippingMinor: 0, taxMinor: 0,
    lines: [{ slug: 'test-chair', name: 'Synthetic chair', quantity: 1, unitPriceMinor: 1000 }] },
  delivery: { recipientName: 'Synthetic buyer', phone: '+92 300 0000000', addressLine1: 'Test street', city: 'Lahore', country: 'PK' },
  reservationExpiresAt: new Date(Date.now() + 3600000).toISOString() });

try {
  attempted = true;
  docker('run', '--detach', '--rm', '--name', name, '--publish', '127.0.0.1::5432',
    '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', '--env', 'POSTGRES_DB=furniro_test', 'postgres:16-alpine');
  for (let attempt = 0; ; attempt++) {
    try { docker('exec', name, 'pg_isready', '-U', 'postgres', '-d', 'furniro_test'); break; }
    catch { if (attempt >= 59) throw new Error('Disposable PostgreSQL did not become ready'); await delay(500); }
  }
  const address = docker('port', name, '5432/tcp');
  assert.match(address, /^127\.0\.0\.1:\d+$/);
  pool = new Pool({ host: '127.0.0.1', port: Number(address.split(':')[1]),
    user: 'postgres', password: 'unused-local-test', database: 'furniro_test', ssl: false,
    max: 4, connectionTimeoutMillis: 5000, idleTimeoutMillis: 1000 });
  pool.on('error', () => { process.exitCode = 1; });
  const db = createCommerceDatabase(pool);
  const migrations = new URL('../db/migrations/', import.meta.url);
  for (const file of readdirSync(migrations).filter(file => file.endsWith('.up.sql')).sort()) {
    await pool.query(readFileSync(new URL(file, migrations), 'utf8'));
  }
  async function reset(stock = 10) {
    await pool.query(`TRUNCATE commerce.cod_collections, commerce.stock_reservation_events,
      commerce.stock_reservations, commerce.inventory_stock, commerce.payment_attempt_events,
      commerce.payment_attempts, commerce.order_events, commerce.order_delivery, commerce.order_items, commerce.orders`);
    await pool.query("INSERT INTO commerce.inventory_stock(product_slug, on_hand) VALUES ('test-chair', $1)", [stock]);
  }
  async function stock() { return (await db.query('SELECT on_hand, reserved FROM commerce.inventory_stock')).rows[0]; }
  // Barrier proves both operations have different live PostgreSQL connections before work starts.
  async function race(first, second) {
    const pids = new Set(); let release;
    const barrier = new Promise(resolve => { release = resolve; });
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Concurrent clients did not reach barrier')), 10000); });
    const concurrent = { transaction: callback => db.transaction(async tx => {
      pids.add((await tx.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
      if (pids.size === 2) release();
      await Promise.race([barrier, timeout]);
      return callback(tx);
    }) };
    let results;
    try { results = await Promise.allSettled([first(concurrent), second(concurrent)]); }
    finally { clearTimeout(timer); }
    assert.equal(pids.size, 2);
    return results;
  }
  await reset();
  const same = input();
  let results = await race(d => createCodCheckout(d)(same), d => createCodCheckout(d)(same));
  assert.ok(results.every(r => r.status === 'fulfilled'));
  assert.equal(results[0].value.orderId, results[1].value.orderId);
  assert.deepEqual(results.map(r => r.value.replayed).sort(), [false, true]);
  assert.equal(Number((await stock()).reserved), 1);
  console.log('PASS concurrent identical checkout creates one order and reservation');

  await reset(1);
  results = await race(d => createCodCheckout(d)(input()), d => createCodCheckout(d)(input()));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(Number((await stock()).reserved), 1);
  assert.equal((await db.query('SELECT * FROM commerce.orders')).rows.length, 1);
  console.log('PASS competing checkout cannot oversell the last unit; loser rolls back');

  await reset();
  const changed = input();
  const other = { ...changed, delivery: { ...changed.delivery, city: 'Karachi' } };
  results = await race(d => createCodCheckout(d)(changed), d => createCodCheckout(d)(other));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(Number((await stock()).reserved), 1);
  console.log('PASS concurrent conflicting checkout key cannot change the saved order');

  await reset();
  const { orderId } = await createCodCheckout(db)(input());
  await createCodFulfilment(db)({ orderId, actorId, targetStatus: 'allocated' });
  results = await race(d => createCodCancellation(d)({ orderId, actorId }),
    d => createCodFulfilment(d)({ orderId, actorId, targetStatus: 'despatched' }));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const order = await readOperatorOrder(db, { orderId });
  assert.equal(order.total_minor, 1000);
  assert.equal(order.items[0].unit_price_minor, 1000);
  assert.equal(order.delivery, null);
  assert.equal(Number((await stock()).reserved), 0);
  assert.equal(Number((await stock()).on_hand), order.status === 'cancelled' ? 10 : 9);
  assert.equal((await db.query("SELECT * FROM commerce.order_events WHERE event_type IN ('cod_cancelled', 'cod_despatched')")).rows.length, 1);
  console.log('PASS cancellation versus despatch has one winner and consistent stock/audit');

  await reset();
  const delivered = await createCodCheckout(db)(input());
  for (const targetStatus of ['allocated', 'despatched', 'delivered']) {
    await createCodFulfilment(db)({ orderId: delivered.orderId, actorId, targetStatus });
  }
  const receipt = { orderId: delivered.orderId, actorId, idempotencyKey: randomUUID(), amountMinor: 1000, receiptReference: 'SYNTHETIC-001' };
  results = await race(d => createCodCollection(d)(receipt), d => createCodCollection(d)(receipt));
  assert.ok(results.every(r => r.status === 'fulfilled'));
  assert.equal(results[0].value.collectionId, results[1].value.collectionId);
  assert.deepEqual(results.map(r => r.value.replayed).sort(), [false, true]);
  assert.equal((await db.query('SELECT * FROM commerce.cod_collections')).rows.length, 1);
  console.log('PASS simultaneous collection retries create one immutable receipt');

  // Deferred constraint failures occur at COMMIT, after the callback has returned.
  await reset();
  await assert.rejects(db.transaction(tx => tx.query(`INSERT INTO commerce.orders
    (idempotency_key, request_hash, payment_method, status, subtotal_minor, discount_minor, shipping_minor, tax_minor, total_minor)
    VALUES ($1, $2, 'cod', 'on_hold', 1000, 0, 0, 0, 1000)`, [randomUUID(), 'a'.repeat(64)])));
  assert.equal((await db.query('SELECT * FROM commerce.orders')).rows.length, 0);
  await createCodCheckout(db)(input());
  console.log('PASS deferred commit failure rolls back and pool remains usable');
} finally {
  try { await pool?.end(); }
  finally {
    // A timed-out docker run can still have created the uniquely named container.
    if (attempted) {
      const existing = docker('ps', '--all', '--filter', `name=^/${name}$`, '--format', '{{.Names}}');
      if (existing === name) docker('rm', '--force', name);
    }
  }
}
