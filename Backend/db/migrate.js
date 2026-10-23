import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

/** Read only versioned repository SQL; hashes are independent of checkout line endings. */
export function readMigrations(directory = new URL('./migrations/', import.meta.url)) {
  return readdirSync(directory).filter(name => /^\d{4}_[a-z0-9_]+\.up\.sql$/.test(name)).sort().map(name => {
    const sql = readFileSync(new URL(name, directory), 'utf8').replace(/\r\n/g, '\n');
    const match = /^BEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/.exec(sql);
    if (!match) throw new Error(`Migration must have one outer transaction: ${name}`);
    return { version: name.replace('.up.sql', ''), checksum: createHash('sha256').update(sql).digest('hex'), sql: match[1] };
  });
}

/** Explicit administrative pool only. No environment reads or automatic adoption/down. */
export async function migrateCommerce(pool, migrations = readMigrations()) {
  if (!migrations.length || new Set(migrations.map(m => m.version.slice(0, 4))).size !== migrations.length ||
      migrations.some((m, i) => !/^\d{4}_[a-z0-9_]+$/.test(m.version) || !/^[a-f0-9]{64}$/.test(m.checksum) || (i && migrations[i - 1].version >= m.version))) {
    throw new Error('Invalid migration sequence');
  }
  const client = await pool.connect();
  let locked = false; let discard = false;
  try {
    const deadline = Date.now() + 30000;
    while (!locked) {
      locked = (await client.query('SELECT pg_try_advisory_lock(714280916) AS locked')).rows[0].locked;
      if (!locked) {
        if (Date.now() >= deadline) throw new Error('Migration lock is busy');
        await delay(50);
      }
    }
    const ledger = (await client.query("SELECT to_regclass('commerce_migrations.applied') AS ledger")).rows[0].ledger;
    if (!ledger) {
      const existing = (await client.query("SELECT 1 FROM pg_namespace WHERE nspname IN ('commerce', 'commerce_migrations')")).rows;
      if (existing.length) throw new Error('Untracked commerce schema requires explicit review');
      await client.query('BEGIN');
      await client.query(`CREATE SCHEMA commerce_migrations;
        REVOKE ALL ON SCHEMA commerce_migrations FROM PUBLIC;
        CREATE TABLE commerce_migrations.applied(version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
        REVOKE ALL ON commerce_migrations.applied FROM PUBLIC`);
      await client.query('COMMIT');
    }
    const applied = (await client.query('SELECT version, checksum FROM commerce_migrations.applied ORDER BY version')).rows;
    for (const [index, row] of applied.entries()) {
      if (row.version !== migrations[index]?.version || row.checksum !== migrations[index]?.checksum) throw new Error('Migration history or checksum mismatch');
    }
    const domainLedger = (await client.query("SELECT to_regclass('commerce.schema_migrations') AS ledger")).rows[0].ledger;
    const versions = domainLedger ? (await client.query('SELECT version FROM commerce.schema_migrations ORDER BY version')).rows.map(r => r.version) : [];
    if (JSON.stringify(versions) !== JSON.stringify(applied.map(r => r.version))) throw new Error('Commerce migration ledgers disagree');
    const completed = [];
    for (const migration of migrations.slice(applied.length)) {
      await client.query('BEGIN');
      await client.query(migration.sql);
      const versionsNow = (await client.query('SELECT version FROM commerce.schema_migrations ORDER BY version')).rows.map(r => r.version);
      if (JSON.stringify(versionsNow) !== JSON.stringify([...applied.map(r => r.version), ...completed, migration.version])) {
        throw new Error('Migration did not record the expected version');
      }
      await client.query('INSERT INTO commerce_migrations.applied(version, checksum) VALUES ($1, $2)', [migration.version, migration.checksum]);
      const result = await client.query('COMMIT');
      if (result.command !== 'COMMIT') throw new Error('Migration did not commit');
      completed.push(migration.version);
    }
    return completed;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { discard = true; }
    throw error;
  } finally {
    if (locked) { try { await client.query('SELECT pg_advisory_unlock(714280916)'); } catch { discard = true; } }
    client.release(discard);
  }
}
