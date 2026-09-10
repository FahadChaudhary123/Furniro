# Runbook: incident response

Production is down or degraded.

🔴 Nothing is deployed yet, so this has never been exercised. It also assumes monitoring
and alerting that do not exist — today you will find out from a person, not a page.

---

## First five minutes

1. **Acknowledge.** Say in the team channel that you are on it. Silence means three people
   debug the same thing separately, or nobody does.
2. **Assess.** Site down, or one feature broken? Everyone, or one user? Started when?
3. **Check the obvious externals** before debugging your own code:
   - Host status page
   - Supabase status page
   - Domain and TLS certificate expiry — a lapsed certificate looks exactly like an outage
4. **Correlate with changes.** A deploy, a migration, a DNS change, an expiring credential.
   Most incidents are the most recent change.
5. **If it followed a deploy → [roll back](rollback.md).** Do not debug forward with users
   affected.

## Severity

Aligned to Document B §6. The acknowledgement targets are the standard to grow into — there
is no on-call rota today, so treat them as intent, not as a commitment anyone is on the
hook for. Doc B §1 is explicit that an unpaid rota decays within two months; do not declare
one before it is staffed and compensated.

| | Meaning | Response | Communication |
|---|---|---|---|
| **Sev 1** | Cannot buy, cannot pay, or a data/security breach | Ack 5 min, all hands, 24/7 | Status page immediately, updates every 30 min |
| **Sev 2** | Major function degraded — search down, orders not reaching the warehouse, notifications failing | Ack 15 min, business hours plus on-call | Internal comms; status page if customer-visible |
| **Sev 3** | Minor or cosmetic, workaround exists | Next working day | Ticket only |
| **Sev 4** | Cosmetic, no trading impact | Backlog | Ticket only |

**A suspected data breach or credential exposure is Sev 1 regardless of user impact.** Go to
[secret-rotation.md](secret-rotation.md) and rotate before investigating — Doc B §7 R12:
preserve evidence first, then contain, and the legal clock starts at awareness.

**Committing a secret is a Sev 2** (Doc B §2), and the required response is rotation, not
deletion from history.

At Furniro's current stage most of these cannot occur — there is nothing to buy and no
payment path. What *can* occur today is the Sev 1 and Sev 2 in the two rules above. See
[OPS_CONFORMANCE.md](../OPS_CONFORMANCE.md) for which parts of Document B are live yet.

## Communicating

Update every 30 minutes during a SEV1, even when the update is "still investigating, no new
information". People fill silence with worse assumptions than the truth.

> **<time>** — Investigating <symptom>, affecting <who>. Cause unknown. Next update <time>.

> **<time>** — Cause identified: <one line>. Fix in progress. ETA <time>.

> **<time>** — Resolved as of <time>. Cause: <one line>. Write-up to follow.

Say what is affected and what you know. Do not speculate about cause in a public channel —
a wrong first guess gets quoted back for weeks.

---

## Common scenarios

### Site returns 404 on refresh, works when navigating

The SPA rewrite is missing on the host. `BrowserRouter` uses the History API; the host must
serve `/index.html` for unknown paths. See
[deployment.md](deployment.md#one-setting-that-is-not-optional). This will be the first
production incident if the rewrite is not configured before launch.

### Blank page, console shows a JS error

Almost always a bad deploy. Roll back, then reproduce locally against that commit. Check
whether a beta `vite` bump is involved — the version is pinned at `8.0.0-beta.13` for a
reason.

### API returns 500 on everything

Check the process is running (`curl /health`), then the boot log — a misconfigured
middleware can log a `ValidationError` and keep serving, so a healthy-looking process is not
proof. Then environment variables: a missing `SUPABASE_URL` yields `undefined` and confusing
downstream failures, and `dotenv` must load before anything reads `process.env` (it does, at
the top of `platform/config.js`). Then Supabase itself.

**Check whether they are real 500s first.** Two conditions used to be reported as server
faults and were not: a malformed request body, and a request from a disallowed CORS origin.
Both are fixed, and both are the shape to watch for — a 500 whose cause is the caller.

### Database unreachable

Check Supabase status, then whether the password was rotated without every environment
being updated, then connection-pool exhaustion — connections that are never released
exhaust the pool and present as an outage under load.

### CORS errors in the browser console

`ALLOWED_ORIGINS` does not include the front-end origin, or `cors` is misconfigured.

**What you will see**, verified by inducing it on 2026-09-09:

- Browser console: `Access to fetch at … has been blocked by CORS policy`.
- The page shows "Products could not be loaded — Could not reach the API at …", not a blank
  screen and not an empty catalogue.
- API log: a single `WARN  CORS origin rejected {"origin":"…"}` line naming the origin. The
  request itself returns **200 with no `Access-Control-Allow-Origin` header** — the browser
  refuses the response, which is where CORS is enforced. It is not a 5xx, and there is no
  stack trace to chase.

The fix is to add the origin to `ALLOWED_ORIGINS` and restart.

**Do not "fix" this by allowing every origin.** `cors()` with no arguments reflects any
origin and is a security fault, not a workaround — see [API.md](../../API.md#cors).

### Suspected credential leak

SEV1. [Rotate first](secret-rotation.md), investigate second. Then check provider access
logs for use you cannot account for.

---

## After it is over

Write it up within two working days, while it is still accurate.

- **What happened**, in plain language.
- **Impact** — who, what, how long.
- **Timeline** — detection, diagnosis, mitigation, resolution.
- **Root cause** — the actual cause, not the trigger. "The deploy broke it" is a trigger;
  "no CI ran the build before merge" is a cause.
- **What went well**, genuinely. Rollback speed, a useful alert.
- **Action items** — each with an owner and a date, or it will not happen.

**Blameless.** People acting reasonably on the information they had is the normal case. If
one person's mistake could take production down, the system permitted it — that is the
finding, and that is what gets fixed. Teams that assign blame get fewer incident reports,
not fewer incidents.

---

## Gaps that will make the first real incident worse

Honest inventory, because knowing this in advance is cheaper than discovering it at 3am:

| Missing | Consequence |
|---|---|
| **Alerting** | Errors are collected (`PLAT-04`) but nothing tells anyone. A user tells you, hours later |
| Uptime monitoring | Nobody knows until someone looks |
| Staging environment | Production is the first place anything runs |
| Backups, and a tested restore | Data loss is permanent. **An untested backup is not a backup** |
| Documented escalation path | Nobody knows who to wake |

*Two rows were removed on 2026-09-09 because they had stopped being true: **tests and CI**
(389 browser checks, 85 API checks, 139 unit tests, all gated in CI) and **structured
logging** (JSON lines with correlation ids since the platform module). "Error tracking" was
narrowed to **alerting** — client and server errors do reach the log now; nothing raises a
hand about them.*

Alerting and uptime monitoring are the two that change the character of every incident that
follows, and neither needs the storefront to be finished.
