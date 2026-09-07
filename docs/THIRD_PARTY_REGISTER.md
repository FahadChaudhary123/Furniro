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
| **Credentials** | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL` in `Backend/.env`. Rotatable in the project dashboard. **Rotation outstanding** — see [secret-rotation.md](runbooks/secret-rotation.md#-outstanding-rotate-before-the-first-commit) |
| **API version** | `@supabase/supabase-js` ^2.96.0. No deprecation date known. Upgrade owner unassigned |
| **Limits** | Free-tier quotas apply; no headroom measurement exists because there is no traffic |
| **Contract** | None. No paid plan, no data-processing agreement. **A DPA is required before storing any personal data** (Doc B §11) |
| **Fallback** | **None documented.** `pg` is installed and could reach the same Postgres directly, but that is the same provider, not a fallback |

**Register gaps for this row:** no status-page subscription, no escalation path, no DPA, no
upgrade owner, no tested fallback. All five are Doc B §16 requirements. None are urgent
while nothing depends on the service — all five become urgent the day something does.

---

## Not yet chosen

Document B assumes these exist. Each needs a register row before it goes live, not after.

| Service | Doc B sections | Blocking |
|---|---|---|
| Payment gateway (primary) | §5, §7 R3, §10, §14 | Checkout |
| Payment gateway (secondary) | §7 R3 — assumes a failover target | Checkout resilience |
| Transactional email provider | §5, §7 R10 | Order confirmations, contact form replies |
| Hosting / CDN | §2, §7 R4, §12, §14 | Any deployment |
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
