import { useEffect, useRef, useState } from 'react';
import { loadOrder, changeOrder } from './auth.js';

const money = (value, currency) => new Intl.NumberFormat('en-PK', {
  style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value / 100);
const statusNames = { pending_payment: 'Pending payment', on_hold: 'On hold', allocated: 'Allocated', despatched: 'Despatched', delivered: 'Delivered', cancelled: 'Cancelled' };

export default function OrderLookup({ client, roles }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);

  async function lookup(event) {
    event.preventDefault();
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const id = new FormData(event.currentTarget).get('order_id').trim();
    setOrder(null); setError(''); setTarget(null); setNotice('');
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) {
      setError('Enter a valid order ID.'); return;
    }
    setBusy(true);
    try {
      const result = await loadOrder(client, id, controller.signal);
      if (!controller.signal.aborted) setOrder(result);
    } catch (failure) { if (!controller.signal.aborted) setError(failure.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }

  async function confirmAction() {
    if (busy || !target || !order) return;
    const id = order.order_id;
    const controller = new AbortController();
    request.current?.abort(); request.current = controller;
    setBusy(true); setError(''); setNotice('');
    try {
      await changeOrder(client, id, target, controller.signal);
      if (controller.signal.aborted) return;
      setOrder(null); setTarget(null);
      setNotice('Action accepted. Refreshing the saved order.');
      const updated = await loadOrder(client, id, controller.signal);
      if (!controller.signal.aborted) { setOrder(updated); setNotice('Order refreshed after the action.'); }
    } catch (failure) {
      if (!controller.signal.aborted) { setOrder(null); setTarget(null); setError(failure.message); }
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const nextStatus = order && { on_hold: 'allocated', allocated: 'despatched', despatched: 'delivered' }[order.status];

  return <section className="mt-8 border-t border-stone-200 pt-6" aria-labelledby="order-lookup-title">
    <h2 id="order-lookup-title" className="text-xl font-semibold">Find an order</h2>
    <p className="mt-2 text-sm text-stone-600">Enter the full order ID to view its saved details.</p>
    <form onSubmit={lookup} className="mt-4 space-y-3">
      <label className="block text-sm font-medium">Order ID<input name="order_id" autoComplete="off" spellCheck={false} required maxLength={36} disabled={busy} className="mt-2 block w-full rounded-lg border border-stone-400 px-3 py-3 focus:outline-hidden focus:ring-2 focus:ring-stone-700" /></label>
      <button disabled={busy} className="rounded-lg bg-stone-900 px-5 py-3 font-semibold text-white hover:bg-stone-700 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50">{busy ? 'Loading order…' : 'Find order'}</button>
    </form>
    {busy && <p role="status" className="mt-4">Loading order details…</p>}
    {notice && <p role="status" className="mt-4">{notice}</p>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {order && <div className="mt-6 space-y-5">
      <h3 className="font-semibold">Order details</h3>
      <p className="break-all font-mono text-sm">{order.order_id}</p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt>Fulfilment status</dt><dd>{statusNames[order.status] || order.status}</dd>
        <dt>Payment method</dt><dd>{order.payment_method === 'cod' ? 'Cash on delivery' : 'Online'}</dd>
        <dt>Placed</dt><dd>{new Date(order.created_at).toLocaleString('en-PK')}</dd>
      </dl>
      <p className="text-sm text-stone-600">Fulfilment status does not confirm payment or cash collection.</p>
      {roles.includes('fulfilment') && order.payment_method === 'cod' && (nextStatus || ['on_hold', 'allocated'].includes(order.status)) && <section aria-label="Order actions" className="space-y-3 rounded-lg border border-stone-300 p-4">
        <h3 className="font-semibold">Order actions</h3>
        {target ? <>
          <p>Confirm changing this order to {statusNames[target]}?</p>
          {target === 'despatched' && <p>Despatch consumes the reserved stock.</p>}
          {target === 'cancelled' && <p>Cancellation releases reserved stock and cannot be undone here.</p>}
          <button type="button" disabled={busy} onClick={confirmAction} className="rounded-lg bg-stone-900 px-4 py-3 text-white disabled:opacity-50">Confirm {statusNames[target]}</button>
          <button type="button" disabled={busy} onClick={() => setTarget(null)} className="ml-2 rounded-lg border px-4 py-3">Keep current status</button>
        </> : <div className="flex flex-wrap gap-3">
          {nextStatus && <button type="button" disabled={busy} onClick={() => setTarget(nextStatus)} className="rounded-lg bg-stone-900 px-4 py-3 text-white">Mark {statusNames[nextStatus]}</button>}
          {['on_hold', 'allocated'].includes(order.status) && <button type="button" disabled={busy} onClick={() => setTarget('cancelled')} className="rounded-lg border border-stone-500 px-4 py-3">Cancel order</button>}
        </div>}
      </section>}
      <h3 className="font-semibold">Items</h3>
      <ul className="space-y-3">{order.items.map(item => <li key={item.line_number} className="rounded-lg bg-stone-50 p-3">
        <p className="font-medium">{item.product_name}</p>
        <p className="mt-1 text-sm">{item.quantity} × {money(item.unit_price_minor, order.currency)}</p>
        <p className="mt-1 text-sm">Line total: {money(item.line_total_minor, order.currency)}</p>
      </li>)}</ul>
      <dl className="grid grid-cols-2 gap-2 text-sm">{[['Subtotal', 'subtotal_minor'], ['Discount', 'discount_minor'], ['Shipping', 'shipping_minor'], ['Tax', 'tax_minor'], ['Total', 'total_minor']].map(([label, field]) => <div key={field} className="contents"><dt className={field === 'total_minor' ? 'font-bold' : ''}>{label}</dt><dd>{money(order[field], order.currency)}</dd></div>)}</dl>
      <h3 className="font-semibold">Delivery</h3>
      {order.delivery ? <address className="wrap-break-word text-sm not-italic leading-6">
        <p>{order.delivery.recipient_name}</p><p>{order.delivery.phone}</p>
        <p>{order.delivery.address_line1}</p>{order.delivery.address_line2 && <p>{order.delivery.address_line2}</p>}
        <p>{order.delivery.city} {order.delivery.postal_code}</p><p>{order.delivery.country}</p>
      </address> : <p className="text-sm text-stone-600">Delivery details are unavailable or restricted to the fulfilment role.</p>}
    </div>}
  </section>;
}
