# Security policy

## Reporting a vulnerability

Email **app@digitaiz.com** with `[SECURITY]` in the subject.

Please do not open a public issue, post to a discussion board, or disclose publicly before
a fix ships. Include:

- What the issue is and where — file, endpoint, or URL.
- Steps to reproduce, ideally the smallest case that shows it.
- What an attacker gains: data read, data written, account takeover, denial of service.
- Anything you already know about a fix.

**Response targets**

| Stage | Target |
|---|---|
| Acknowledgement | 3 working days |
| Initial assessment and severity | 10 working days |
| Fix for critical issues | 30 days |
| Fix for everything else | Next release |

We will keep you updated, credit you if you would like to be credited, and tell you when
the fix is live. Testing against your own local instance is welcome. Please do not run
automated scanners against hosted environments, access data that is not yours, or degrade
service for others.

---

## Scope note

The table that prompted this policy assumed the project handles user data and payments.
**Today it handles neither.** There is no authentication, no cart, no checkout, no payment
integration, and no persistence of any kind — the contact form has no submit handler and
discards what is typed into it. The front end makes no network calls at all.

That does not make the project risk-free, and the exposure below is real and current. The
controls in the later sections are the ones that must be in place *before* the first byte
of user data is accepted — which will be the contact form.

---

## ⚠ Current exposure — act on this first

### 1. Live credentials sit in `Backend/.env` with no ignore rule

`Backend/.env` contains real, non-placeholder values for `SUPABASE_URL`,
`SUPABASE_ANON_KEY` and `DATABASE_URL`. **`Backend/.gitignore` is an empty file** and there
is no `.gitignore` at the repository root.

The project is not yet a git repository, which is the only reason nothing has leaked. The
moment someone runs `git init && git add .`, those credentials are committed — and a
credential that has ever been committed must be treated as compromised, because rewriting
history does not reach forks, clones, CI caches or the scrapers that watch public pushes in
real time.

`DATABASE_URL` is the serious one. A Postgres connection string embeds the **database
password** and grants direct read/write access to the whole database, bypassing row-level
security entirely. It is not a public key and must never reach a browser, a bundle, or a
repository.

**Fix, in order:**

1. Ignore rules are now in place — `.gitignore` at the root and in `Backend/`, both
   covering `.env` and its variants. Verify with `git check-ignore -v Backend/.env` once
   the repo is initialised.
2. **Rotate `DATABASE_URL` and `SUPABASE_ANON_KEY` now**, in the Supabase dashboard, before
   any git history exists. Rotating is cheap today and expensive after the first push.
3. Confirm `git status` never lists `.env` before the first commit.
4. Use `Backend/.env.example` — committed, keys only, no values — as the template.

### 2. Know what the anon key is

`SUPABASE_ANON_KEY` is *designed* to be public and will end up in client-side code if the
front end ever talks to Supabase directly. That is safe **only if row-level security is
enabled on every table.** Without RLS the anon key is a full read/write credential handed
to every visitor.

Supabase tables have RLS off by default. [DATA_MODEL.md](DATA_MODEL.md#proposed-schema)
enables it on every table and grants `select` only.

The `service_role` key is the opposite: it bypasses RLS completely. It belongs on the
server, in an environment variable, and nowhere else — never in `Frontend/`, never behind a
`VITE_` prefix, never in a log line.

### 3. No dependency auditing

No CI, no `npm audit` in any workflow, and `Frontend` runs a **beta** of Vite 8 pinned
through `overrides` — which forces that version onto transitive dependents too, including
any that have not been tested against it. Nothing currently tells you when a dependency
develops a known vulnerability.

Run `npm audit` in both `Frontend/` and `Backend/` before each release, and add Dependabot
or equivalent when the repo goes to a host that supports it.

---

## Secret handling

**Never commit a secret.** Not in `.env`, not in a config file, not in a comment, not in a
test fixture, not in a commit message.

| Value | Lives | May reach the browser |
|---|---|---|
| `SUPABASE_URL` | Both tiers | Yes |
| `SUPABASE_ANON_KEY` | Both tiers | Yes — **only with RLS enabled** |
| `DATABASE_URL` | Server only | **Never** |
| `service_role` key | Server only | **Never** |
| Payment provider secret key | Server only | **Never** |
| Payment provider publishable key | Front end | Yes |

### The `VITE_` rule

Vite exposes every variable prefixed `VITE_` by inlining it into the production bundle as a
string literal. **Anything with that prefix is public.** It is not obscured by
minification, it is trivially recoverable with view-source, and there is no way to
un-publish it after a deploy.

Only ever prefix values that would be fine on a billboard. If you are unsure, it does not
get the prefix.

### If a secret leaks

1. **Rotate first.** Revoke and reissue in the provider dashboard. Do this before anything
   else — removing the file does not un-leak the value.
2. Purge it from history (`git filter-repo`) and force-push, understanding that this does
   not reach anyone who already cloned.
3. Check provider logs for use you cannot account for.
4. Note the rotation in [CHANGELOG.md](CHANGELOG.md) without repeating the value.

Runbook: [docs/runbooks/secret-rotation.md](docs/runbooks/secret-rotation.md).

---

## Handling user data

Nothing is collected today. The contact form will be first, so these apply from the commit
that gives it an `onSubmit`.

**Collect the minimum.** Name, email, message. Not a phone number, not an address, until
something actually needs one. Data you never collected cannot leak.

**Validate server-side, always.** Client validation is a UX affordance. An attacker posts
directly to the endpoint and never runs your JavaScript. Rules in
[API.md](API.md#post-apicontact).

**Escape on output, per context.** A stored message is attacker-controlled text. React
escapes it in JSX automatically — `dangerouslySetInnerHTML` opts out of that protection and
is the single most common route to stored XSS in a React app. It is not used anywhere in
this codebase today; keep it that way. Email and admin views need their own escaping.

**Parameterise every query.** With `supabase-js` the query builder does this. If raw SQL
via `pg` is ever added, use `$1` placeholders — never template-literal interpolation.

**Rate limit every public write.** Otherwise the contact endpoint is a free spam relay and
a trivial way to fill the database.

**Do not log personal data.** No request bodies containing messages or emails, no tokens,
no credentials. Log a correlation id and look up what you need deliberately.

**Have a retention rule.** Contact submissions get an expiry — 12 months is a reasonable
default — and something that actually deletes them. Indefinite retention is a growing
liability with no upside.

**Legal basis.** Collecting personal data brings obligations under GDPR and similar regimes
depending on where customers are: a privacy notice at the point of collection, a lawful
basis, and a route to access and deletion requests. Worth settling before launch, not
after.

---

## Payments

Not implemented. Non-negotiable when they are:

1. **Never handle raw card details.** Use a hosted checkout or the provider's client-side
   element. Card data must not touch your servers, your logs, or your database — that is
   both the PCI-DSS position and the only sane one.
2. **The client never sends a price or a total.** It sends `product_id` and `quantity`; the
   server reads the price from the database and computes the total. A total in a request
   body is a number the buyer chose.
3. **Verify webhook signatures.** An unverified payment webhook endpoint is an unauthorised
   "mark this order paid" button on the public internet.
4. **Webhooks must be idempotent.** Providers retry. Keyed on the event id, a retry must
   not ship a second parcel or issue a second refund.
5. **Secret keys server-side only.** Publishable key in the front end, secret key in the
   server environment.
6. **Snapshot prices onto the order.** A later catalogue change must never alter what a
   past customer is recorded as having paid.

---

## Transport and headers

**HTTPS everywhere in production.** No exceptions — a session token over plain HTTP is a
session token given away on shared Wi-Fi.

Set on the front-end host:

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` — or a CSP `frame-ancestors 'none'` |
| `Content-Security-Policy` | Start in report-only, tighten, then enforce |

On the API, use `helmet` (not currently a dependency) and configure `cors` with an explicit
origin allowlist. **`cors()` with no arguments reflects any origin** — see
[API.md](API.md#cors).

---

## Supported versions

Pre-release. Only the current state of the default branch is supported; there are no
tagged releases yet. See [CHANGELOG.md](CHANGELOG.md).
