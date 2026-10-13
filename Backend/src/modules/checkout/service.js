import { createHash } from 'node:crypto';
import { writeCodOrder } from '../orders/index.js';
import { reserveOrderStock } from '../inventory/index.js';

const money = (value) => Number.isSafeInteger(value) && value >= 0;

/** Internal server-quote boundary. Never pass browser prices or totals into this service. */
function prepareQuote(quote) {
  if (!quote || quote.currency !== 'PKR' || !Array.isArray(quote.lines) || !quote.lines.length ||
      ![quote.discountMinor, quote.shippingMinor, quote.taxMinor].every(money)) {
    throw new Error('A complete server-generated PKR quote is required');
  }
  const seen = new Set();
  const lines = quote.lines.map((line) => {
    if (!line || typeof line.slug !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(line.slug) ||
        seen.has(line.slug) || typeof line.name !== 'string' || !line.name.trim() || line.name.length > 200 ||
        !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99 ||
        !money(line.unitPriceMinor) || line.unitPriceMinor === 0) {
      throw new Error('Invalid or duplicate quoted product line');
    }
    seen.add(line.slug);
    return { slug: line.slug, name: line.name, quantity: line.quantity, unitPriceMinor: line.unitPriceMinor };
  }).sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
  const subtotal = lines.reduce((sum, line) => sum + BigInt(line.quantity) * BigInt(line.unitPriceMinor), 0n);
  const total = subtotal - BigInt(quote.discountMinor) + BigInt(quote.shippingMinor) + BigInt(quote.taxMinor);
  if (subtotal > BigInt(Number.MAX_SAFE_INTEGER) || BigInt(quote.discountMinor) > subtotal ||
      total < 1n || total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Quoted totals are outside the supported money range');
  }
  return { lines, subtotal: Number(subtotal), discount: quote.discountMinor,
    shipping: quote.shippingMinor, tax: quote.taxMinor, total: Number(total) };
}

/** Requires an adapter whose transaction callback commits atomically or rolls back on error. */
export function createCodCheckout(db) {
  return async ({ idempotencyKey, quote, reservationExpiresAt }) => {
    if (typeof idempotencyKey !== 'string' ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(idempotencyKey)) {
      throw new Error('A UUID idempotency key is required');
    }
    if (typeof reservationExpiresAt !== 'string' || !Number.isFinite(Date.parse(reservationExpiresAt))) {
      throw new Error('An explicit reservation expiry is required');
    }
    const prepared = prepareQuote(quote);
    const hash = createHash('sha256').update(JSON.stringify({ method: 'cod', currency: 'PKR', ...prepared })).digest('hex');
    return db.transaction(async (tx) => {
      const order = await writeCodOrder(tx, { key: idempotencyKey, hash, ...prepared });
      if (!order.replayed) {
        await reserveOrderStock(tx, { orderId: order.orderId, lines: prepared.lines, expiresAt: reservationExpiresAt });
      }
      return order;
    });
  };
}
