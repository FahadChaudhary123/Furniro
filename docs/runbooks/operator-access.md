# Operator API access

The API verifies Supabase Auth bearer tokens and enforces MFA plus server-assigned roles.
It is disabled by default. No live account or database has been contacted during development.
The separate `Operator/` app provides password sign-in, TOTP setup/verification and sign-out.
It is built independently from the storefront. Customer login/registration is also still unimplemented.

## Configure before activation

1. Complete credential rotation and the provider/privacy review. Use individual Supabase
   Auth users, never shared accounts. Enrol MFA and obtain an `aal2` session through a
   trusted Supabase client. The API does not accept passwords or enrol MFA on users' behalf.
2. Set server `OPERATOR_AUTH_URL` to the HTTPS Supabase project origin and
   `OPERATOR_AUTH_PUBLISHABLE_KEY` to a current `sb_publishable_` key. Legacy anon keys and
   service-role/secret keys are not accepted by this feature. Do not copy live values into docs.
3. Set `OPERATOR_ACCESS` to a JSON object mapping exact Supabase user UUIDs to role arrays.
   Example with a **synthetic** UUID:

   ```json
   {"00000000-0000-0000-0000-000000000001":["fulfilment"]}
   ```

   `fulfilment` permits cancellation and fulfilment transitions. `finance` permits COD
   collection. Grant both only when required. No wildcard, implicit administrator or
   user-editable metadata grants access. Keep this roster private and review it monthly.
4. Set `OPERATOR_AUTH_ENABLED=true`, add the separate operator client's origin to the API
   CORS allowlist, and restart the API. A malformed roster or missing configuration denies
   all operator access. Removing a user or role requires updating the roster and restarting
   **every instance**. This is the immediate application-side revocation mechanism.
5. Call `GET /api/operator/session` using `Authorization: Bearer <access-token>` in a trusted
   client. Never put tokens in URLs, screenshots, logs, shell history or committed files.
   Expect the user's UUID and assigned roles only. No token, email or user metadata is returned.

## Commerce integration gate

The default app has no production database adapter. Session verification can work once Auth
is configured, but protected order actions return `COMMERCE_UNAVAILABLE` until a reviewed
transaction adapter is passed to `createApp({commerceDb})`. Do not use PGlite as production
storage or connect the live `.env` database as an implicit fallback. Apply reviewed migrations
and verify database roles, backups, retention and concurrency before connecting real orders.

The API derives every `actorId` from the authenticated user. Request bodies cannot supply
or override it. Auth runs before role checks and order lookup. Repeated operations are
still subject to current authorization; existing commerce idempotency behavior is preserved.
See [API.md](../../API.md#operator-endpoints) for bodies and responses.

## Failure and session behavior

- Missing/invalid token: 401. Valid identity without operator access: 403.
- No verified MFA (`aal2`): 403 `MFA_REQUIRED`; enrol/challenge MFA through the Auth client.
- Provider/network/configuration failure: 503; access stays denied. Provider exception text
  is discarded. Each outbound request has a five-second timeout.
- Browser cookies and query-string tokens do not authenticate. The API creates no sessions,
  refresh tokens or cookies; the trusted client handles sign-in, MFA, refresh and sign-out.
- Do not promise that provider sign-out instantly invalidates every existing access token.
  Respect provider access-token expiry; remove the server roster entry and restart instances
  when immediate operator removal is required.
- Rate limits are per-process. Multi-instance deployment still needs a shared limiter.
- Request/error logs mask operator paths to `/api/operator`, omitting order IDs, tokens,
  identities and bodies. Domain actions retain the operator UUID in their existing audit records.

## Verification

Local tests use newly generated signing keys, real signed JWTs, synthetic Auth responses
and disposable PostgreSQL databases. They cover signatures, expiry/issuer/audience, MFA,
role separation, audit-identity spoofing, provider failures and protected COD operations.
The smoke suite verifies that every operator action rejects anonymous callers. No live
MFA enrolment, provider account or production permission setup has been verified.

Provider references: [getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims),
[getUser](https://supabase.com/docs/reference/javascript/auth-getuser),
[MFA](https://supabase.com/docs/guides/auth/auth-mfa).

## Separate sign-in application

Run `npm ci` then `npm run dev` in `Operator/` (http://localhost:5174).
Set `VITE_API_URL` using `.env.example`; include this origin in `ALLOWED_ORIGINS`.
The API exposes `GET /api/operator/auth-config`, returning only the public Auth origin and
publishable key when valid and enabled, otherwise `{enabled:false}`. No private roster or
service key is published. The UI does not collect credentials when disabled.

Provision individual email/password users through the provider; there is no public signup
or password-reset workflow here. Operators sign in, enrol a TOTP authenticator using a
manual setup key if needed, then verify a six-digit code. Server session verification must
succeed before roles are shown. Signed-in operators can look up one order by its full UUID.
Saved items, totals and fulfilment status are shown; delivery details require fulfilment
access. Finance-only users receive no delivery data. Fulfilment status does not confirm
payment collection. Fulfilment operators can confirm allocation, despatch, delivery and pre-despatch cancellation for COD orders. Each action reloads the saved order; errors clear stale details and require a new lookup. Order lists and payment history screens remain pending.
Lookup returns an explicit unavailable error until commerce storage is connected; it does
not fall back to sample orders. Results are cleared on another lookup, sign-out or expiry.

Sessions are memory-only, with automatic refresh disabled. Reload requires another login;
expiry locks the screen. Sign-out requests provider local-scope logout and discards the
client even if the provider is unavailable. Existing bearer tokens can remain valid until
expiry. Only this app's abandoned unverified factors are removed during setup retries.

`npm run verify` checks lint/build; `npm run e2e` runs isolated browser tests with synthetic
provider responses on desktop/mobile. It never uses live credentials. Host this app on a
separate trusted HTTPS origin with no-store HTML and appropriate security headers; deployment
remains deferred. Do not record live MFA screens in screenshots or browser traces.

## Recording COD collection

Finance operators can record the full total of a delivered PKR COD order. Enter an
internal receipt code (no names or contact details), confirm that the full amount was
received in cash, review, and confirm collection. Partial receipts and corrections are
not supported. The API rechecks roles, delivery/stock history, total and uniqueness.

A successful acknowledgement shows the collection reference and whether this is a replay.
It records operator-entered evidence, not verified courier remittance or bank settlement.
Order lookup does not include collection history: absence of an acknowledgement on a new
lookup does not mean the order is unpaid. Reconcile existing receipt records first.

For timeouts, unavailable storage/provider or invalid acknowledgements, use **Retry same
collection** on the same screen. The amount, receipt and retry UUID remain unchanged.
Do not change the receipt to work around a conflict. A conflict requires finance review;
401/403 requires a new sign-in or corrected access. Rate limits require waiting.

Drafts and retry details stay in memory only. Another lookup, reload, sign-out or expiry
clears them; unmount aborts the browser request but cannot undo a committed server write.
After leaving an uncertain submission, reconcile the original receipt before trying again.
Normal startup still has no commerce adapter; live account setup and storage remain gates.
