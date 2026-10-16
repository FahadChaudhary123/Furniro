/** One statement gives a consistent snapshot; orders reads only its own tables. */
export async function readOperatorOrder(db, { orderId, includeDelivery = false }) {
  const { rows } = await db.query(`SELECT o.id AS order_id, o.currency, o.payment_method,
    o.status, o.created_at, o.subtotal_minor, o.discount_minor, o.shipping_minor,
    o.tax_minor, o.total_minor,
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'line_number', i.line_number, 'product_slug', i.product_slug,
      'product_name', i.product_name, 'quantity', i.quantity,
      'unit_price_minor', i.unit_price_minor, 'line_total_minor', i.line_total_minor)
      ORDER BY i.line_number) FROM commerce.order_items i WHERE i.order_id = o.id), '[]') AS items,
    CASE WHEN $2::boolean THEN (SELECT jsonb_build_object(
      'recipient_name', d.recipient_name, 'phone', d.phone, 'address_line1', d.address_line1,
      'address_line2', d.address_line2, 'city', d.city, 'postal_code', d.postal_code,
      'country', d.country) FROM commerce.order_delivery d WHERE d.order_id = o.id)
      ELSE NULL END AS delivery
    FROM commerce.orders o WHERE o.id = $1`, [orderId, includeDelivery]);
  const result = rows[0];
  if (!result) return null;
  for (const field of ['subtotal_minor', 'discount_minor', 'shipping_minor', 'tax_minor', 'total_minor']) {
    result[field] = Number(result[field]);
    if (!Number.isSafeInteger(result[field])) throw new Error('Invalid stored money');
  }
  return result;
}
