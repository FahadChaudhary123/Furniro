import { useEffect, useRef, useState } from 'react';
import { collectCod } from './auth.js';

const buttonClass = 'rounded-lg bg-stone-900 px-4 py-3 text-white disabled:opacity-50';

export default function CodCollection({ client, order }) {
  const [draft, setDraft] = useState(null);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const [result, setResult] = useState(null);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const amount = new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(order.total_minor / 100);

  function review(event) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const receipt = fields.get('receipt').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._/-]{0,99}$/.test(receipt) || fields.get('received') !== 'on') {
      setFailure({ message: 'Enter a valid internal receipt code and confirm receipt of the full amount.' }); return;
    }
    setFailure(null);
    setDraft({ amount_minor: order.total_minor, receipt_reference: receipt, idempotency_key: crypto.randomUUID() });
  }

  async function submit() {
    if (!draft || request.current || result) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setStarted(true); setFailure(null);
    try {
      const saved = await collectCod(client, order.order_id, draft, controller.signal);
      if (!controller.signal.aborted) setResult(saved);
    } catch (error) {
      if (!controller.signal.aborted) setFailure({ message: error.message, retryable: error.retryable });
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false); }
    }
  }

  return <section aria-labelledby="cod-title" className="space-y-3 rounded-lg border border-stone-300 p-4">
    <h3 id="cod-title" className="font-semibold">Record COD collection</h3>
    <p className="text-sm">Record the full cash amount only after receiving it. Partial collections and corrections are not supported here.</p>
    <p className="text-sm">This records receipt evidence, not verified remittance or bank settlement. Previous collection history is not shown here.</p>
    {result ? <div role="status" className="space-y-2">
      <p>{result.replayed ? 'Previously recorded collection confirmed.' : 'COD collection recorded.'}</p>
      <p className="break-all">Collection reference: {result.collection_id}</p>
    </div> : draft ? <div className="space-y-3">
      <p>Confirm cash received: <strong>{amount}</strong></p>
      <p className="break-all">Receipt: {draft.receipt_reference}</p>
      <p className="text-sm">Stay on this order to retry the same submission if needed. Reloading, another lookup or signing out clears this local retry information.</p>
      {(!started || failure?.retryable) && <button type="button" className={buttonClass} disabled={busy} onClick={submit}>{started ? 'Retry same collection' : 'Confirm collection'}</button>}
      {!started && <button type="button" className="ml-2 rounded-lg border px-4 py-3" onClick={() => { setDraft(null); setFailure(null); }}>Edit receipt</button>}
      {busy && <p role="status">Recording collection...</p>}
    </div> : <form onSubmit={review} className="space-y-3">
      <p>Full order amount: <strong>{amount}</strong></p>
      <label className="block text-sm font-medium">Receipt reference<input name="receipt" required maxLength={100} autoComplete="off" spellCheck={false} aria-describedby="receipt-help" className="mt-2 block w-full rounded-lg border border-stone-400 px-3 py-3" /></label>
      <p id="receipt-help" className="text-sm">Use an internal code starting with a letter or number, then letters, numbers, dots, underscores, slashes or hyphens. Do not enter customer names or contact details.</p>
      <label className="flex items-start gap-2"><input type="checkbox" name="received" required className="mt-1" />I confirm receipt of the full {amount} in cash.</label>
      <button className={buttonClass}>Review collection</button>
    </form>}
    {failure && <p role="alert" className="text-sm text-red-800">{failure.message}</p>}
  </section>;
}
