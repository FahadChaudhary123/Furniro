/** Receives the shared transaction and line identities from checkout; owns only inventory writes. */
export async function releaseOrderStock(tx, orderId) {
  const { rows } = await tx.query(`SELECT line_number, status FROM commerce.stock_reservations
    WHERE order_id = $1 ORDER BY product_slug, line_number FOR UPDATE`, [orderId]);
  if (rows.some((row) => row.status === 'consumed')) throw new Error('Consumed stock requires reconciliation');
  for (const row of rows) {
    if (row.status === 'active') await tx.query(`UPDATE commerce.stock_reservations
      SET status = 'released' WHERE order_id = $1 AND line_number = $2`, [orderId, row.line_number]);
  }
}

export async function reserveOrderStock(tx, { orderId, lines, expiresAt }) {
  for (const [index, line] of lines.entries()) {
    await tx.query(`INSERT INTO commerce.stock_reservations
      (order_id, line_number, product_slug, quantity, expires_at)
      VALUES ($1, $2, $3, $4, $5)`,
    [orderId, index + 1, line.slug, line.quantity, expiresAt]);
  }
}
