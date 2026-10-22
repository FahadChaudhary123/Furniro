/**
 * Explicit node-postgres Pool injection: no environment lookup, migrations or live
 * connection at import time. The owner configures TLS/timeouts and closes the pool.
 * Callbacks must await queries and perform database work only. No automatic replay.
 */
export function createCommerceDatabase(pool) {
  if (!pool || typeof pool.connect !== 'function' || typeof pool.query !== 'function') {
    throw new TypeError('A PostgreSQL pool is required');
  }
  return {
    query: (sql, parameters) => pool.query(sql, parameters),
    async transaction(callback) {
      const client = await pool.connect();
      let active = false;
      let committing = false;
      let discard = false;
      let queryFailure;
      try {
        await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
        active = true;
        await client.query("SET LOCAL lock_timeout = '5s'");
        await client.query("SET LOCAL statement_timeout = '15s'");
        await client.query("SET LOCAL idle_in_transaction_session_timeout = '15s'");
        const tx = Object.freeze({
          async query(sql, parameters) {
            if (!active) throw new Error('Transaction is no longer active');
            try { return await client.query(sql, parameters); }
            catch (error) { queryFailure = error; throw error; }
          },
        });
        const result = await callback(tx);
        // PostgreSQL can answer COMMIT with ROLLBACK after a swallowed query error.
        if (queryFailure) throw queryFailure;
        active = false;
        committing = true;
        const commit = await client.query('COMMIT');
        if (commit.command !== 'COMMIT') throw new Error('Transaction did not commit');
        return result;
      } catch (error) {
        active = false;
        discard = committing;
        try { await client.query('ROLLBACK'); } catch { discard = true; }
        throw error;
      } finally {
        active = false;
        client.release(discard);
      }
    },
  };
}
