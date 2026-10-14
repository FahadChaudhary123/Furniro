import { advanceCodOrder } from '../orders/index.js';
import { fulfilOrderStock } from '../inventory/index.js';

const uuid = (value) => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);

/** Internal only: caller must authorize an operator and supply their trusted actor ID. */
export function createCodFulfilment(db) {
  return async ({ orderId, actorId, targetStatus }) => {
    if (!uuid(orderId) || !uuid(actorId)) throw new Error('Order and operator UUIDs are required');
    if (!['allocated', 'despatched', 'delivered'].includes(targetStatus)) throw new Error('Unsupported COD transition');
    return db.transaction(async (tx) => {
      const result = await advanceCodOrder(tx, { orderId, actorId, targetStatus });
      await fulfilOrderStock(tx, { ...result, targetStatus });
      return { orderId, status: result.status, replayed: result.replayed };
    });
  };
}
