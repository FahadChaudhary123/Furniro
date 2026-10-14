import { cancelCodOrder } from '../orders/index.js';
import { releaseOrderStock } from '../inventory/index.js';

const uuid = (value) => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

/** Internal only. Caller must authorize the operator and supply their trusted actor ID. */
export function createCodCancellation(db) {
  return async ({ orderId, actorId }) => {
    if (!uuid(orderId) || !uuid(actorId)) throw new Error('Order and operator UUIDs are required');
    return db.transaction(async (tx) => {
      const result = await cancelCodOrder(tx, { orderId, actorId });
      // Recheck reservations even on replay: inconsistent consumed stock must fail closed.
      await releaseOrderStock(tx, orderId);
      return result;
    });
  };
}
