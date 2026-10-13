/** Called inside the checkout transaction; no connection or credentials are created here. */
export async function writeCodOrder(tx, { key, hash, lines, subtotal, discount, shipping, tax, total }) {
  const { rows } = await tx.query(`INSERT INTO commerce.orders
    (idempotency_key, request_hash, payment_method, status, subtotal_minor,
     discount_minor, shipping_minor, tax_minor, total_minor)
    VALUES ($1, $2, 'cod', 'on_hold', $3, $4, $5, $6, $7)
    ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
  [key, hash, subtotal, discount, shipping, tax, total]);
  if (!rows.length) {
    const existing = (await tx.query(
      'SELECT id, request_hash FROM commerce.orders WHERE idempotency_key = $1', [key],
    )).rows[0];
    if (!existing || existing.request_hash !== hash) {
      throw new Error('Idempotency key was already used for a different order');
    }
    return { orderId: existing.id, replayed: true };
  }
  const orderId = rows[0].id;
  for (const [index, line] of lines.entries()) {
    await tx.query(`INSERT INTO commerce.order_items
      (order_id, line_number, product_slug, product_name, quantity, unit_price_minor)
      VALUES ($1, $2, $3, $4, $5, $6)`,
    [orderId, index + 1, line.slug, line.name, line.quantity, line.unitPriceMinor]);
  }
  return { orderId, replayed: false };
}
