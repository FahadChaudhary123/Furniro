import { expect, it, vi } from 'vitest';
import { createCommerceDatabase } from './commerceDatabase.js';

function fixture(fail = {}) {
  const client = { query: vi.fn(async sql => {
    if (fail[sql]) throw fail[sql];
    return { command: sql, rows: [{ value: 1 }] };
  }), release: vi.fn() };
  const pool = { connect: vi.fn(async () => client), query: vi.fn() };
  return { client, pool, db: createCommerceDatabase(pool) };
}
it('pins all writes and commit to one client and prevents use after release', async () => {
  const { db, client, pool } = fixture(); let saved;
  expect(await db.transaction(async tx => { saved = tx; await tx.query('SELECT $1', [1]); return 7; })).toBe(7);
  expect(pool.query).not.toHaveBeenCalled();
  expect(client.query).toHaveBeenCalledWith('SELECT $1', [1]);
  expect(client.query.mock.calls.at(-1)).toEqual(['COMMIT']);
  expect(client.release).toHaveBeenCalledExactlyOnceWith(false);
  await expect(saved.query('SELECT 1')).rejects.toThrow('no longer active');
});
it('rolls back callback failures and does not replay them', async () => {
  const { db, client } = fixture(); const callback = vi.fn(() => { throw new Error('domain failure'); });
  await expect(db.transaction(callback)).rejects.toThrow('domain failure');
  expect(callback).toHaveBeenCalledTimes(1);
  expect(client.query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
  expect(client.release).toHaveBeenCalledExactlyOnceWith(false);
});
it('rejects swallowed SQL failures rather than reporting a false commit', async () => {
  const { db, client } = fixture({ broken: new Error('query failure') });
  await expect(db.transaction(async tx => { try { await tx.query('broken'); } catch { /* deliberate misuse */ } })).rejects.toThrow('query failure');
  expect(client.query).not.toHaveBeenCalledWith('COMMIT');
});
it('discards connections after ambiguous commit and never retries', async () => {
  const { db, client, pool } = fixture({ COMMIT: new Error('connection lost') });
  await expect(db.transaction(async () => 1)).rejects.toThrow('connection lost');
  expect(pool.connect).toHaveBeenCalledTimes(1);
  expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
});
it('preserves original failure if rollback fails and discards the client', async () => {
  const { db, client } = fixture({ ROLLBACK: new Error('rollback failed') });
  await expect(db.transaction(() => { throw new Error('original'); })).rejects.toThrow('original');
  expect(client.release).toHaveBeenCalledExactlyOnceWith(true);
});
it('releases after BEGIN failure and propagates pool acquisition failure', async () => {
  const { db, client, pool } = fixture({ 'BEGIN ISOLATION LEVEL READ COMMITTED': new Error('begin failed') });
  await expect(db.transaction(() => {})).rejects.toThrow('begin failed');
  expect(client.release).toHaveBeenCalledTimes(1);
  pool.connect.mockRejectedValueOnce(new Error('pool unavailable'));
  await expect(db.transaction(() => {})).rejects.toThrow('pool unavailable');
  expect(client.release).toHaveBeenCalledTimes(1);
});
