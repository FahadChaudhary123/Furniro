import { Router } from 'express';
import { AppError } from '../../platform/index.js';
import { createCodCancellation, createCodFulfilment, createCodCollection } from '../checkout/index.js';
import { readOperatorOrder } from '../orders/index.js';

const uuid = (value) => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const conflicts = new Set([
  'Only COD orders can use this cancellation operation',
  'Cancelled order requires reconciliation',
  'Only on-hold or allocated COD orders can be cancelled before despatch',
  'Order history requires reconciliation before cancellation',
  'Consumed stock requires reconciliation', 'Only COD orders can use this operation',
  'Order history requires reconciliation', 'Invalid COD state transition',
  'Incomplete order reservations', 'Order stock requires reconciliation',
  'Expired reservations cannot be consumed',
  'COD collection requires a delivered COD order', 'Delivery history requires reconciliation',
  'Collected amount must match the full order total',
  'COD collection conflicts with an existing order, receipt or retry key',
]);

/** Auth always runs before permissions, input validation or any commerce operation. */
export function createOperatorRouter({ authenticate, publicConfig = { enabled: false }, db = null }) {
  const router = Router();
  router.get('/auth-config', (req, res) => res.set('Cache-Control', 'no-store').json(publicConfig));
  const services = db ? {
    cancel: createCodCancellation(db), fulfil: createCodFulfilment(db), collect: createCodCollection(db),
  } : null;
  router.use(async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.vary('Authorization');
    try { req.operator = await authenticate(req.get('authorization')); }
    catch (error) {
      if (error.status === 401) res.setHeader('WWW-Authenticate', 'Bearer');
      throw error;
    }
    next();
  });
  router.get('/session', (req, res) => res.json({ operator_id: req.operator.id, roles: req.operator.roles }));
  router.get('/orders/:orderId', async (req, res) => {
    if (!req.operator.roles.some(role => ['fulfilment', 'finance'].includes(role))) {
      throw new AppError(403, 'FORBIDDEN', 'This operator role cannot view orders.');
    }
    if (!uuid(req.params.orderId) || Object.keys(req.query).length) {
      throw new AppError(400, 'VALIDATION_FAILED', 'A valid order ID is required.');
    }
    if (!db) throw new AppError(503, 'COMMERCE_UNAVAILABLE', 'Commerce storage is not connected.');
    let order;
    try {
      order = await readOperatorOrder(db, {
        orderId: req.params.orderId.toLowerCase(), includeDelivery: req.operator.roles.includes('fulfilment'),
      });
    } catch { throw new AppError(503, 'COMMERCE_UNAVAILABLE', 'The order could not be loaded.'); }
    if (!order) throw new AppError(404, 'NOT_FOUND', 'Order not found.');
    res.json(order);
  });

  function action(role, fields, operation, validate, map) {
    return async (req, res) => {
      if (!req.operator.roles.includes(role)) throw new AppError(403, 'FORBIDDEN', 'This operator role cannot perform that action.');
      const body = req.body;
      if (!req.is('application/json') || !uuid(req.params.orderId) || !body || typeof body !== 'object' || Array.isArray(body) ||
          Object.keys(body).some((key) => !fields.includes(key)) || !validate(body)) {
        throw new AppError(400, 'VALIDATION_FAILED', 'Invalid operator action request.');
      }
      if (!services) throw new AppError(503, 'COMMERCE_UNAVAILABLE', 'Commerce storage is not connected.');
      try {
        const result = await services[operation]({ ...map(body), orderId: req.params.orderId.toLowerCase(), actorId: req.operator.id });
        res.json({ order_id: result.orderId, replayed: result.replayed,
          ...(result.status ? { status: result.status } : {}),
          ...(result.collectionId ? { collection_id: result.collectionId } : {}),
        });
      } catch (error) {
        if (error.message === 'Order not found') throw new AppError(404, 'NOT_FOUND', 'Order not found.');
        if (conflicts.has(error.message)) throw new AppError(409, 'ORDER_CONFLICT', 'The order action conflicts with its current state.');
        throw new AppError(503, 'COMMERCE_UNAVAILABLE', 'The order action could not be completed.');
      }
    };
  }
  router.post('/orders/:orderId/cancel', action('fulfilment', [], 'cancel', () => true, () => ({})));
  router.post('/orders/:orderId/fulfilment', action('fulfilment', ['target_status'], 'fulfil',
    (body) => ['allocated', 'despatched', 'delivered'].includes(body.target_status), (body) => ({ targetStatus: body.target_status })));
  router.post('/orders/:orderId/collections', action('finance', ['amount_minor', 'receipt_reference', 'idempotency_key'], 'collect',
    (body) => Number.isSafeInteger(body.amount_minor) && body.amount_minor > 0 && uuid(body.idempotency_key) &&
      typeof body.receipt_reference === 'string' && /^[a-z0-9][a-z0-9._/-]{0,99}$/i.test(body.receipt_reference),
    (body) => ({ amountMinor: body.amount_minor, receiptReference: body.receipt_reference, idempotencyKey: body.idempotency_key })));
  return router;
}
