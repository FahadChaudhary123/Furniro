/** Called inside the checkout transaction; no connection or credentials are created here. */
export async function cancelCodOrder(tx, { orderId, actorId }) {
  const order = (await tx.query('SELECT payment_method, status FROM commerce.orders WHERE id = $1 FOR UPDATE', [orderId])).rows[0];
  if (!order) throw new Error('Order not found');
  if (order.payment_method !== 'cod') throw new Error('Only COD orders can use this cancellation operation');
  if (order.status === 'cancelled') {
    const event = (await tx.query("SELECT id FROM commerce.order_events WHERE order_id = $1 AND event_type = 'cod_cancelled'", [orderId])).rows[0];
    if (!event) throw new Error('Cancelled order requires reconciliation');
    return { orderId, replayed: true };
  }
  if (order.status !== 'on_hold') throw new Error('Only on-hold COD orders can be cancelled');
  await tx.query("UPDATE commerce.orders SET status = 'cancelled' WHERE id = $1", [orderId]);
  await tx.query("INSERT INTO commerce.order_events(order_id, event_type, actor_id) VALUES ($1, 'cod_cancelled', $2)", [orderId, actorId]);
  return { orderId, replayed: false };
}

/** Caller coordinates inventory validation in the same transaction. */
export async function getCollectableCodOrder(tx, orderId) {
  const order = (await tx.query('SELECT payment_method, status, total_minor FROM commerce.orders WHERE id = $1 FOR UPDATE', [orderId])).rows[0];
  if (!order) throw new Error('Order not found');
  if (order.payment_method !== 'cod' || order.status !== 'delivered') {
    throw new Error('COD collection requires a delivered COD order');
  }
  const event = (await tx.query("SELECT id FROM commerce.order_events WHERE order_id = $1 AND event_type = 'cod_delivered'", [orderId])).rows[0];
  if (!event) throw new Error('Delivery history requires reconciliation');
  const lineCount = (await tx.query('SELECT count(*)::integer AS count FROM commerce.order_items WHERE order_id = $1', [orderId])).rows[0].count;
  return { totalMinor: Number(order.total_minor), lineCount };
}

export async function advanceCodOrder(tx, { orderId, actorId, targetStatus }) {
  const predecessors = { allocated: 'on_hold', despatched: 'allocated', delivered: 'despatched' };
  if (!Object.hasOwn(predecessors, targetStatus)) throw new Error('Unsupported COD transition');
  const order = (await tx.query('SELECT payment_method, status FROM commerce.orders WHERE id = $1 FOR UPDATE', [orderId])).rows[0];
  if (!order) throw new Error('Order not found');
  if (order.payment_method !== 'cod') throw new Error('Only COD orders can use this operation');
  const events = (await tx.query('SELECT event_type FROM commerce.order_events WHERE order_id = $1', [orderId])).rows.map((row) => row.event_type);
  const eventType = `cod_${targetStatus}`;
  const replayed = order.status === targetStatus;
  if (replayed && !events.includes(eventType)) throw new Error('Order history requires reconciliation');
  if (!replayed) {
    if (order.status !== predecessors[targetStatus]) throw new Error('Invalid COD state transition');
    if (events.includes(eventType) || (targetStatus !== 'allocated' && !events.includes(`cod_${order.status}`))) {
      throw new Error('Order history requires reconciliation');
    }
    await tx.query('UPDATE commerce.orders SET status = $2 WHERE id = $1', [orderId, targetStatus]);
    await tx.query('INSERT INTO commerce.order_events(order_id, event_type, actor_id) VALUES ($1, $2, $3)', [orderId, eventType, actorId]);
  }
  const lineCount = (await tx.query('SELECT count(*)::integer AS count FROM commerce.order_items WHERE order_id = $1', [orderId])).rows[0].count;
  return { orderId, status: targetStatus, replayed, lineCount };
}

export async function writeCodOrder(tx, { key, hash, lines, subtotal, discount, shipping, tax, total, delivery }) {
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
  await tx.query(`INSERT INTO commerce.order_delivery
    (order_id, recipient_name, phone, address_line1, address_line2, city, postal_code, country)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
  [orderId, delivery.recipientName, delivery.phone, delivery.addressLine1,
    delivery.addressLine2, delivery.city, delivery.postalCode, delivery.country]);
  for (const [index, line] of lines.entries()) {
    await tx.query(`INSERT INTO commerce.order_items
      (order_id, line_number, product_slug, product_name, quantity, unit_price_minor)
      VALUES ($1, $2, $3, $4, $5, $6)`,
    [orderId, index + 1, line.slug, line.name, line.quantity, line.unitPriceMinor]);
  }
  return { orderId, replayed: false };
}
