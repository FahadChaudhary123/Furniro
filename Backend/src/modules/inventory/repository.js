/** Receives the shared transaction and line identities from checkout; owns only inventory writes. */
export async function reserveOrderStock(tx, { orderId, lines, expiresAt }) {
  for (const [index, line] of lines.entries()) {
    await tx.query(`INSERT INTO commerce.stock_reservations
      (order_id, line_number, product_slug, quantity, expires_at)
      VALUES ($1, $2, $3, $4, $5)`,
    [orderId, index + 1, line.slug, line.quantity, expiresAt]);
  }
}
