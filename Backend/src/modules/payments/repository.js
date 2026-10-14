/** Internal transaction boundary. Collection records are immutable payment evidence. */
export async function recordCodCollection(tx, { orderId, amountMinor, idempotencyKey, receiptReference, actorId }) {
  const { rows } = await tx.query(`INSERT INTO commerce.cod_collections
    (order_id, amount_minor, idempotency_key, receipt_reference, actor_id)
    VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id`,
  [orderId, amountMinor, idempotencyKey, receiptReference, actorId]);
  if (rows.length) return { collectionId: rows[0].id, orderId, replayed: false };
  const previous = (await tx.query(`SELECT id, order_id, amount_minor, receipt_reference
    FROM commerce.cod_collections WHERE idempotency_key = $1`, [idempotencyKey])).rows[0];
  if (!previous || previous.order_id !== orderId || Number(previous.amount_minor) !== amountMinor ||
      previous.receipt_reference !== receiptReference) {
    throw new Error('COD collection conflicts with an existing order, receipt or retry key');
  }
  return { collectionId: previous.id, orderId, replayed: true };
}
