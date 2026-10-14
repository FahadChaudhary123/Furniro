import { getCollectableCodOrder } from '../orders/index.js';
import { fulfilOrderStock } from '../inventory/index.js';
import { recordCodCollection } from '../payments/index.js';

const uuid = (value) => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

/** Internal only: authorize the operator before calling; amount is observed cash, not a price. */
export function createCodCollection(db) {
  return async ({ orderId, actorId, idempotencyKey, amountMinor, receiptReference }) => {
    if (![orderId, actorId, idempotencyKey].every(uuid)) throw new Error('Order, operator and retry UUIDs are required');
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 1) throw new Error('A positive integer collection amount is required');
    if (typeof receiptReference !== 'string' || !/^[a-z0-9][a-z0-9._/-]{0,99}$/i.test(receiptReference)) {
      throw new Error('A collection receipt reference is required');
    }
    // Canonical UUIDs and receipt codes keep case-only retries identical.
    const input = { orderId: orderId.toLowerCase(), actorId: actorId.toLowerCase(),
      idempotencyKey: idempotencyKey.toLowerCase(), amountMinor, receiptReference: receiptReference.toUpperCase() };
    return db.transaction(async (tx) => {
      const order = await getCollectableCodOrder(tx, input.orderId);
      if (amountMinor !== order.totalMinor) throw new Error('Collected amount must match the full order total');
      await fulfilOrderStock(tx, { orderId: input.orderId, lineCount: order.lineCount, targetStatus: 'delivered', replayed: true });
      return recordCodCollection(tx, input);
    });
  };
}
