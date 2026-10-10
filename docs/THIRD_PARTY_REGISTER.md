# Third-party dependency register

Required by Document B §16, which calls this *"the first thing an incident responder reads
and the first thing a new engineer needs."*

One row per external service. Started now, while there is one entry rather than fifteen.

**Never record a credential value here.** Record where it lives and who can rotate it.
Registers get shared, screenshotted and pasted into chat. See [SECURITY.md](../SECURITY.md).

---

## Supabase

| Field | Value |
|---|---|
| **Service & purpose** | Managed Postgres. Intended to also provide Auth and Storage. Not yet used by any running code |
| **Criticality** | Store-stopping *once integrated* — it is the only planned data store. Currently **cosmetic**: nothing reads from it |
| **Support route** | Dashboard support. Escalation path not established — free-tier projects have no SLA |
| **Status page** | <https://status.supabase.com> — **not currently subscribed by anyone** |
| **Credentials** | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL` in `Backend/.env`. Rotatable in the project dashboard. **Rotation outstanding** — see [secret-rotation.md](runbooks/secret-rotation.md#-outstanding-rotate-now) |
| **API version** | `@supabase/supabase-js` ^2.96.0. No deprecation date known. Upgrade owner unassigned |
| **Limits** | Free-tier quotas apply; no headroom measurement exists because there is no traffic |
| **Contract** | None. No paid plan, no data-processing agreement. **A DPA is required before storing any personal data** (Doc B §11) |
| **Fallback** | **None documented.** `pg` is installed and could reach the same Postgres directly, but that is the same provider, not a fallback |

**Register gaps for this row:** no status-page subscription, no escalation path, no DPA, no
upgrade owner, no tested fallback. All five are Doc B §16 requirements. None are urgent
while nothing depends on the service — all five become urgent the day something does.

---

## GitHub

Added because the project now depends on it operationally, not just for storage.

| Field | Value |
|---|---|
| **Service & purpose** | Source hosting and CI (`.github/workflows/ci.yml`). Gates every merge: lint, build, performance budgets, end-to-end, API smoke, dependency audit, secret scan. Dependabot is configured to propose weekly npm and workflow-action updates |
| **Criticality** | **Degrading.** An outage blocks merges and releases; it does not affect anything running |
| **Support route** | Community support on the free plan. No SLA |
| **Status page** | <https://www.githubstatus.com> — **not currently subscribed by anyone** |
| **Credentials** | Repository access via the owner's account. `GITHUB_TOKEN` is issued per workflow run and scoped to `contents: read` |
| **API version** | Actions: `actions/checkout@v4`, `actions/setup-node@v4`, `gitleaks/gitleaks-action@v2`, `actions/upload-artifact@v4`. Pinned to major versions, so minor updates arrive silently |
| **Limits** | Free-tier Actions minutes. Current usage is small; no headroom measurement |
| **Contract** | Free plan. No DPA. No repository data is customer personal data today |
| **Fallback** | **None.** CI is the only automated gate; without it, verification is `npm run verify`, `npm run e2e` and `npm run smoke` locally |

**Register gaps:** no status-page subscription, actions pinned by major version rather than
SHA (a supply-chain consideration Doc B §10 would flag), and no secret-scanning alert
routing.

---

## Render

| Field | Value |
|---|---|
| **Service & purpose** | Selected host for the static storefront and Node API; `render.yaml` defines both services |
| **Criticality** | Store-stopping once deployed; neither service is live yet |
| **Support route** | Dashboard support; account plan and escalation path have not been confirmed |
| **Status page** | Subscription and alert recipient have not been confirmed |
| **Credentials** | Repository connection and account access in Render; the Blueprint requests only public origins and the API CORS allowlist. Dashboard settings have not been verified |
| **API version** | Blueprint defined in `render.yaml`; no Render API integration |
| **Limits** | Account plan, quotas and usage have not been confirmed |
| **Contract** | Account plan and any data-processing terms have not been reviewed |
| **Fallback** | Roll back to a prior deploy after the first successful release; no alternate host is configured |

**Before first deployment:** confirm the account owner and backup, connect the repository,
set the public origins, verify live smoke checks and route uptime/error alerts to a person.
See [deployment.md](runbooks/deployment.md) and [OWNERSHIP.md](OWNERSHIP.md).

---

## Not yet chosen

Document B assumes these exist. Each needs a register row before it goes live, not after.

| Service | Doc B sections | Blocking |
|---|---|---|
| Payment gateway (primary) | §5, §7 R3, §10, §14 | Checkout |
| Payment gateway (secondary) | §7 R3 — assumes a failover target | Checkout resilience |
| Transactional email provider | §5, §7 R10 | Order confirmations, contact form replies |
| Error tracking | §5, §6 | Knowing an incident happened |
| Uptime monitoring | §5 | Knowing before a customer tells you |
| Carrier / fulfilment API | §7 R9, §15 | Shipping |
| Search provider | §5, §7 R7, §15 | Site search |

---

## Review

Doc B §4 requires a monthly review of third-party changelogs and deprecation notices, and a
quarterly review of usage, spend, SLA performance and renewal dates.

With one free-tier row, the monthly review is: check the Supabase changelog, confirm the
`supabase-js` major version is still current. Two minutes. It becomes a real review at
Stage 3 of the [conformance roadmap](OPS_CONFORMANCE.md#adoption-roadmap).

Doc B §18: *renewal dates go in the calendar with the notice period subtracted.* Nothing to
diarise yet — the first paid contract is the trigger to start.
