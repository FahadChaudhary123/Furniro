import { useEffect, useRef, useState } from 'react';
import { loadClient, verifyAccess } from './auth.js';
import OrderLookup from './OrderLookup.jsx';

const inputClass = 'mt-2 block w-full rounded-lg border border-stone-400 bg-white px-3 py-3 text-stone-950 focus:outline-hidden focus:ring-2 focus:ring-stone-700';
const buttonClass = 'rounded-lg bg-stone-900 px-5 py-3 font-semibold text-white hover:bg-stone-700 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-stone-900 disabled:opacity-50';

export default function App() {
  const client = useRef(null);
  const [stage, setStage] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [factor, setFactor] = useState(null);
  const [operator, setOperator] = useState(null);

  async function start() {
    setStage('loading'); setError('');
    try { client.current = await loadClient(); setStage(client.current ? 'login' : 'disabled'); }
    catch { setError('Sign-in could not load. Check your connection and try again.'); setStage('unavailable'); }
  }
  useEffect(() => { void start(); }, []);
  useEffect(() => {
    if (!operator) return;
    const timer = setTimeout(() => { setOperator(null); setStage('expired'); setFactor(null); }, Math.max(0, operator.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [operator]);

  async function run(action) {
    setBusy(true); setError('');
    try { await action(); }
    catch (failure) { setError(failure.message || 'Sign-in failed. Please try again.'); }
    finally { setBusy(false); }
  }
  async function access() {
    setFactor(null); setStage('verify');
    const result = await verifyAccess(client.current);
    setOperator(result); setStage('ready');
  }
  async function login(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const email = values.get('email').trim(), password = values.get('password');
    form.reset();
    await run(async () => {
      const result = await client.current.auth.signInWithPassword({ email, password });
      if (result.error) throw new Error('Unable to sign in. Check your details and try again.');
      setStage('factors');
      await factors();
    });
  }
  async function factors() {
    const result = await client.current.auth.mfa.listFactors();
    if (result.error) throw new Error('Could not load authenticators. Please retry.');
    const verified = result.data.totp.find(item => item.status === 'verified');
    if (verified) { setFactor(verified); setStage('mfa'); }
    else setStage('enrol');
  }
  async function enrol() {
    // Remove only this app's abandoned, unverified enrolments before a retry.
    const existing = await client.current.auth.mfa.listFactors();
    if (existing.error) throw new Error('Could not load authenticators. Please retry.');
    for (const item of existing.data.all.filter(item => item.factor_type === 'totp' && item.status === 'unverified' && item.friendly_name === 'Furniro operator')) {
      const removed = await client.current.auth.mfa.unenroll({ factorId: item.id });
      if (removed.error) throw new Error('Could not restart authenticator setup. Please retry.');
    }
    const result = await client.current.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Furniro operator' });
    if (result.error) throw new Error('Authenticator setup failed. Please retry.');
    setFactor({ id: result.data.id, secret: result.data.totp.secret }); setStage('mfa');
  }
  async function verify(event) {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get('code');
    event.currentTarget.reset();
    await run(async () => {
      const result = await client.current.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (result.error) throw new Error('That code could not be verified. Enter a fresh code and try again.');
      await access();
    });
  }
  async function signOut() {
    await run(async () => {
      const old = client.current;
      client.current = null; setOperator(null); setFactor(null); setStage('loading');
      const result = await old.auth.signOut({ scope: 'local' });
      await start();
      if (result.error) setError('Signed out of this page. Provider sign-out could not be confirmed; existing tokens remain valid until expiry.');
    });
  }

  return <main className="min-h-screen bg-stone-100 px-5 py-12 text-stone-900 sm:py-20">
    <div className="mx-auto max-w-md">
      <p className="mb-8 text-3xl font-bold tracking-tight">Furniro<span className="ml-3 text-sm font-normal text-stone-600">Operations</span></p>
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8" aria-busy={busy}>
        <h1 className="text-2xl font-semibold">{stage === 'ready' ? 'Operator access verified' : 'Operator sign in'}</h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">Use your assigned account and an authenticator app. Access is limited to your approved roles.</p>
        {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {stage === 'loading' && <p role="status" className="mt-6">Loading sign-in…</p>}
        {stage === 'disabled' && <p className="mt-6">Operator sign-in is not configured. Ask the account owner to enable operator access.</p>}
        {['disabled', 'unavailable'].includes(stage) && <button className={`${buttonClass} mt-5`} onClick={start}>Retry</button>}
        {stage === 'login' && <form onSubmit={login} className="mt-6 space-y-5">
          <label className="block text-sm font-medium">Email<input className={inputClass} type="email" name="email" autoComplete="username" required maxLength={254} disabled={busy}/></label>
          <label className="block text-sm font-medium">Password<input className={inputClass} type="password" name="password" autoComplete="current-password" required maxLength={1024} disabled={busy}/></label>
          <button className={`${buttonClass} w-full`} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="text-sm text-stone-600">Need an account or password reset? Contact the account owner.</p>
        </form>}
        {stage === 'factors' && <button className={`${buttonClass} mt-6`} disabled={busy} onClick={() => run(factors)}>Retry authenticators</button>}
        {stage === 'enrol' && <div className="mt-6 space-y-4"><h2 className="font-semibold">Set up your authenticator</h2><p>Add a Furniro entry in your authenticator app using the setup key on the next screen.</p><button className={buttonClass} disabled={busy} onClick={() => run(enrol)}>Set up authenticator</button></div>}
        {stage === 'mfa' && <form className="mt-6 space-y-5" onSubmit={verify}>
          {factor.secret && <div><p className="text-sm">Enter this setup key in your authenticator app. Keep it private.</p><p className="mt-3 break-all rounded-lg bg-stone-100 p-3 font-mono" aria-label="Authenticator setup key">{factor.secret}</p></div>}
          <label className="block text-sm font-medium">Authenticator code<input className={inputClass} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={busy}/></label>
          <button className={buttonClass} disabled={busy}>Verify code</button>
        </form>}
        {stage === 'verify' && <button className={`${buttonClass} mt-6`} disabled={busy} onClick={() => run(access)}>Retry access check</button>}
        {stage === 'expired' && <p role="status" className="mt-6">Your session expired. Sign out and sign in again.</p>}
        {stage === 'ready' && <div className="mt-6 space-y-4"><p role="status">You are signed in.</p><h2 className="font-semibold">Assigned roles</h2><ul className="list-inside list-disc">{operator.roles.map(role => <li key={role}>{role}</li>)}</ul><OrderLookup client={client.current} roles={operator.roles} /></div>}
        {!['loading', 'login', 'disabled', 'unavailable'].includes(stage) && <button className="mt-6 rounded-sm px-2 py-2 font-medium underline focus-visible:outline-solid disabled:opacity-50" disabled={busy} onClick={signOut}>Sign out</button>}
      </section>
      <p className="mt-6 text-center text-sm text-stone-600">For your security, reloading this page ends this local session.</p>
    </div>
  </main>;
}
