# Operations conformance: Document B vs. Furniro

Maps the *E-commerce maintenance and operations runbook* (Document B, Rev 1.0) against what
this repository actually contains, section by section, and gives the order in which each
part becomes real.

**Document B is the target, not the current state.** It is a good standard and worth
keeping. This document exists so the distance is measured rather than assumed — an ops
manual for a system you do not have is a document nobody follows.

> **Scope decision (2026-09-07): Furniro is the system Document B governs.** The current
> four-page storefront grows into everything Doc B assumes — payments, orders, fulfilment,
> search, the lot. Stages 1–4 of the [roadmap](#adoption-roadmap) are therefore the plan of
> record, not a hypothetical. Every ⏳ in the table below is scheduled work, not a
> permanent exclusion.
>
> **Document A was not supplied.** Document B was provided again in its place and confirmed
> as the requirements document, so the functional requirements have been *derived* from it
> and written up as [REQUIREMENTS.md](REQUIREMENTS.md) — 134 requirements, each cited to the
> Doc B section that implies it. That is a reconstruction to correct, not agreed scope.

---

## Two things to settle first

### Document A is missing

Document B is explicitly derived: *"the operating manual for the system specified in
Document A"*, and its footer states *"requirement IDs point to Document A."* Document B
references requirement IDs in §16 and §17 that cannot be resolved without it.

**Document B is the maintenance and operations manual. The functional requirements are in
Document A.** If the goal is to build the system, Document A is the document that says what
to build. Nothing in Document B specifies a feature — it specifies how to keep features
running once they exist.

### The scale gap

| Document B assumes | Furniro has |
|---|---|
| Payment gateway, plus a secondary to fail over to | No payment code, no provider account |
| Orders, carts, reservations, ATP, oversell handling | No cart. No order. No persistence |
| Warehouse, carriers, label printing, manifests | None |
| Search cluster with alias-swap reindexing | No search. The navbar search icon has no handler |
| Database replicas, WAL/binlog, cross-region failover | No database. `Backend/index.js` is 0 bytes |
| CDN, WAF, status page, error tracking, uptime monitoring | None |
| ERP/PIM feeding price and stock | 32 product rows hardcoded in a `.jsx` file |
| `local`, `ci`, `staging`, `production` | `local` only |
| CI with 7 gates blocking merge | No CI. **No git repository** |
| 10 named role-holders, 24/7 paid on-call rota | One contact address |
| Trading revenue, error budgets, unit economics | No customers, no revenue, no spend |

Document B's closing test is *"could the on-call engineer, at 3 a.m., restore trading after
a payment gateway outage?"* For Furniro the honest answer is that there is no trading, no
gateway, and no on-call — so the test cannot be failed yet, which is not the same as
passing it.

---

## Section-by-section

| | Section | Status | Notes |
|---|---|---|---|
| §1 | Purpose and ownership | ◐ | Ten accountable roles collapse to one person. The register is still worth writing — Doc B's own rule is that "the team" is not an owner |
| §2 | Environments and configuration | ◐ | Config is env-driven and validated; the health endpoint reports build SHA, config version and flag state as §2 requires. Only `local` exists as an environment |
| §3 | Release management | ◐ | CI gates now defined in `.github/workflows/ci.yml`; they activate on `git init` + push. The migration discipline (expand → backfill → switch → drop) is already recorded in [rollback.md](runbooks/rollback.md#when-a-migration-is-involved) |
| §4 | Maintenance calendar | ◐ | 7 of 26 items are meaningful today — the catalogue completeness sweep (`CAT-04`) and the zero-result query review (`SRCH-05`) both have data to review now. The rest reference orders, payments, carriers or stock |
| §5 | Monitoring, SLOs, alerting | ◐ | Client and server errors are collected (`PLAT-04`) and catalogue latency is measured (`npm run latency`). **No alerting** — a log is a record, not a page. SLOs over checkout and orders stay unmeasurable |
| §6 | Incident management | ◐ | Severity model and post-incident review are adoptable now. Now aligned in [incident-response.md](runbooks/incident-response.md) |
| §7 | Runbooks R1–R12 | ⏳ | R4's correlation-id diagnosis is now possible. Still 2 of 12 applicable: R4 and R12. The other ten need payments, stock, queues, search, carriers or email |
| §8 | Backup and disaster recovery | ⏳ | No data to back up. Supabase supplies snapshots and PITR once there is a schema |
| §9 | Database and storage upkeep | ⏳ | No database |
| §10 | Security maintenance | ✅ | **The most applicable section, and the one with an open breach.** See below |
| §11 | Privacy and data retention | ◐ | **It applies now.** Five processing activities exist, recorded in [PROCESSING_REGISTER.md](PROCESSING_REGISTER.md) (`PRIV-06`). No privacy notice, no retention enforcement, no subject-request route |
| §12 | Performance and capacity | ✅ | Budgets now enforced in CI and met. Capacity planning still needs traffic |
| §13 | Peak event readiness | ➖ | No peak, no traffic |
| §14 | Cost management | ➖ | No infrastructure spend |
| §15 | Catalogue and content operations | ◐ | Oversized originals fixed, alt text correct, WebP served via `<picture>` (39 derivatives), publish gate and completeness report built. AVIF and ERP/PIM ingestion outstanding |
| §16 | Third-party dependency register | ✅ | One real dependency (Supabase). Register created |
| §17 | Support tiers and SLAs | ➖ | No customers, no tickets |
| §18 | Documentation discipline | ✅ | Docs, runbooks and decision records all in place. Runbook testing is the remaining habit |
| §19 | Deprecation and sunset | ➖ | Nothing to retire |
| §20 | Handover pack | ◐ | A reasonable goal to hold; most artefacts do not exist yet |

✅ adoptable now (4) · ◐ partially adoptable (9) · ⏳ blocked on something that does not
exist (3) · ➖ not applicable at this scope (4)

Counted from the table above, not from memory. Two sections moved out of *blocked* since the
last pass: §5 because errors are now collected and latency measured, and §11 because the
system genuinely processes personal data — that row previously said "nothing is collected",
which stopped being true and is the kind of stale assurance a conformance document exists to
prevent.

*Updated after the Stage 0 pass of 2026-09-07: §12 met, §3 and §15 advanced.*
*Updated 2026-09-08: §15 advanced again — publish gate (`CAT-03`) and completeness report (`CAT-04`) built.*
*Updated 2026-09-09: §5 and §11 moved from blocked to partial; §4 and §12 figures corrected.*

---

## What is actionable today

### §10 Security maintenance — one item is already breached

Document B §2: *"Committing a secret is treated as a Sev 2 incident and the secret is
rotated, not just removed from history."*

`Backend/.env` holds live, non-placeholder values for `SUPABASE_ANON_KEY` and
`DATABASE_URL`. `Backend/.gitignore` was a 0-byte file until the previous pass. Nothing has
leaked only because there was no git repository at the time. **That is no longer true** —
the repository exists on GitHub with CI running against it, and whether `.env` reached the
history has not been verified.

By Doc B's own rule this is **Sev 2 the moment `git init` runs**, and the required response
is rotation, not deletion. §10 also schedules secret rotation quarterly regardless.

**Outstanding:** rotate both credentials. Procedure:
[secret-rotation.md](runbooks/secret-rotation.md#-outstanding-rotate-now).

Also adoptable from §10 with no back end at all:

- **Dependency vulnerability scanning** — now a blocking CI gate across both packages.
  It was red on arrival: **23 vulnerabilities, 15 high**, including `react-router-dom`,
  a runtime dependency. All resolved non-breaking; both packages now report zero. This is
  the clearest argument for the gate — the vulnerabilities were already there, and nothing
  in the project would have reported them.
- **Secret scanning in CI** — `gitleaks` or equivalent, so the §2 rule is enforced
  mechanically rather than by memory.
- **Security headers and TLS audit** (§10, quarterly) — the header set is already specified
  in [SECURITY.md](../SECURITY.md#transport-and-headers); it needs a host to apply it to.

### §12 Performance budgets — now enforced and met

Doc B §12: *"Budgets are enforced in CI. Bundle size, image weight and third-party script
count are gates, not guidelines."*

Enforced by `Frontend/scripts/check-budgets.mjs`, run as a blocking CI gate and available
locally as `npm run budgets`.

| Metric | Before | Now | Budget |
|---|---|---|---|
| Total assets (one visitor) | 24.0 MB | **1.62 MB** | 1.90 MB |
| Largest single asset | 4.0 MB (`bedroom.jpg`) | **270 kB** (the JS bundle) | 300 kB |
| Images over 1 MB | 10 | **0** | — |
| JS gzipped | 123 kB | 104 kB | 115 kB |
| CSS gzipped | 4 kB | 4.7 kB | 25 kB |
| Third-party scripts | 0 | 0 | 0 |

*Figures from `npm run budgets` on 2026-09-09, not from memory. The budgets have been
ratcheted twice as the numbers came down — a budget left at the original headroom stops
being a gate.*

**A 90% reduction in shipped bytes.** The source images were camera originals — one was
6000x6000, another 5616x3744 — served verbatim to browsers that render them at a few
hundred pixels. `Frontend/scripts/optimise-images.mjs` resizes to a 1600px max edge and
re-encodes; originals are preserved in `Frontend/.image-originals/` (gitignored) and every
run re-encodes from those, so repeated runs never compound JPEG loss.

The single largest win was a format error rather than a compression one: `hero-bg.png` was
a photograph with no alpha channel stored as PNG. As JPEG it is **69 kB against 1.27 MB** —
95% smaller for one changed import line.

Both were done. Routes are code-split, and `gsap`, `react-icons` and `framer-motion` are
gone — JS is down to **93.1 kB gzipped** and the largest asset is an image again. Budgets
were ratcheted to match.

**Done since for §15:** WebP derivatives are served through `<picture>` with the original as
fallback (`Frontend/src/shared/ui/Picture.jsx`, 39 derivatives), and §15's "checked by the
publish gate, not by eye" is now literally true — `publishGate.js` blocks incomplete products
at the data boundary and `npm run completeness` reports the rest. Measured first: correcting
intrinsic dimensions to the rendered box saved 42% of image weight against 25% for the format
change, so sizing was done before format.

**Still outstanding for §15:** AVIF, which needs another `<source>` and another derivative
pass, and ERP/PIM ingestion of price and stock (`CAT-09`) — that one is an architectural
decision, not a task.

### §16 Third-party register

Created at [THIRD_PARTY_REGISTER.md](THIRD_PARTY_REGISTER.md). One row today. Doc B calls
this *"the first thing an incident responder reads"*, and it costs nothing to start while
there is one entry rather than fifteen.

### §18 Documentation discipline

Mostly satisfied. Two of Doc B's rules are worth adopting explicitly:

- ~~**Architecture decisions recorded as short dated notes**~~ **Done** —
  [docs/decisions/](decisions/) holds ten records with context, decision, alternatives and
  consequences. Written retrospectively, which Doc B would not endorse; records from here on
  should ship with the change that makes them.
- ~~**Runbooks are tested**~~ **Started.** `local-development.md` was executed as written on
  2026-09-08 and produced four defects, including a setup that did not work at all. The
  execution log lives in [runbooks/README.md](runbooks/README.md).
  `secret-rotation.md` is the next one that can genuinely be run.

Doc B's onboarding test — *a new engineer reaches a running local environment and a first
merged change in under three days* — is currently untestable in its second half: there is
no repository to merge into.

---

## Adoption roadmap

Each stage turns on the Doc B sections that become measurable at that point. Nothing here
requires adopting Doc B out of order, which is the usual way an ops standard gets abandoned.

### Stage 0 — no back end (now)

Everything here is doable this week and none of it is thrown away later.

- [x] `git init`, `main` as default — done; `.env` handling still needs verifying
- [ ] **Rotate `DATABASE_URL` and `SUPABASE_ANON_KEY`** (§2, §10)
- [x] CI running lint + build + `npm audit` + secret scan on every PR (§3 gates, reduced) — `.github/workflows/ci.yml`; running
- [x] Bundle and image budgets enforced in CI (§12) — `Frontend/scripts/check-budgets.mjs`
- [~] Compress images (§12, §15) — **done**, 24 MB -> 2.51 MB. WebP/AVIF derivatives and
      below-the-fold lazy-loading still outstanding (both need component changes)
- [x] Third-party register started (§16)
- [ ] Ownership register, honest about being one person (§1)
- [x] Dependency vulnerabilities triaged to zero in both packages (§10)
- [x] Platform module built — health endpoint, correlation ids, structured logging, error
      handling, CORS allowlist (`PLAT-01`–`04`, part of §2 and §5)
- [ ] Execute `local-development.md` as written and correct what is wrong (§18)

### Stage 1 — back end and database exist

- [ ] `staging` environment, seeded and non-production (§2)
- [ ] Backups verified by **restore**, with the wall-clock time recorded as the real RTO
      (§8) — Doc B: *"a backup is a rumour until it has been restored"*
- [ ] Migration discipline: expand → backfill → switch → drop, never rename in one step (§3)
- [ ] Runbooks R4 (5xx) and R5 (database saturation) become real (§7)
- [ ] Error tracking and uptime monitoring — the first alerting that can page anyone (§5)
- [ ] Retention and purge jobs designed **with** the contact form, not after it (§11)
- [ ] Privacy notice and lawful basis before the first submission is stored (§11)

### Stage 2 — accounts and cart

- [ ] Monthly access review; MFA on every back-office and cloud identity (§10)
- [ ] Abandoned-cart retention (90 days per §11) enforced by a monitored job (§9)
- [ ] Subject request intake route (§11)

### Stage 3 — payments and orders

The stage where the bulk of Document B switches on, and the stage that justifies it.

- [ ] SLOs become measurable: checkout success, authorisation success, availability (§5)
- [ ] Alert catalogue and the on-call rota, with compensation agreed in writing (§1, §5)
- [ ] Runbooks R1, R2, R3, R11 (§7)
- [ ] Daily settlement-vs-ledger reconciliation (§4)
- [ ] PCI scope review; no card data in logs, analytics or backups (§10)
- [ ] Canary deploys with automatic rollback on checkout-conversion breach (§3)
- [ ] Order price snapshots and server-computed totals — already specified in
      [DATA_MODEL.md](../DATA_MODEL.md#not-yet-designed) and [API.md](../API.md#cart-and-checkout)

### Stage 4 — fulfilment, search, scale

- [ ] Carrier integration and R9; warehouse and R8 (§7)
- [ ] Search cluster, R7, zero-result review (§7, §15)
- [ ] Peak readiness (§13), cost management (§14), support tiers (§17)
- [ ] Quarterly load tests and DR exercises (§4)

---

## Recommended reductions

Document B is written for a trading business with a platform team. Applied verbatim to a
pre-launch project it produces ceremony nobody performs, and a standard nobody performs is
worse than a smaller one they do. Suggested changes, to be revisited at Stage 3:

| Doc B | Reduce to | Why |
|---|---|---|
| 10 accountable roles (§1) | One owner, named, with a documented escalation contact | Ten roles across one person is a fiction; Doc B's rule that "the team" is not an owner still holds |
| 24/7 on-call, 5-minute Sev 1 ack (§1) | Best-effort, no rota | Doc B itself: *"an unpaid rota decays within two months"* |
| `local` / `ci` / `staging` / `production` (§2) | `local` / `ci` / `production` | Add `staging` when there is a database whose migrations can go wrong |
| 7 CI gates (§3) | lint, build, `npm audit`, secret scan | e2e and accessibility gates need tests and a purchase path; add them with the thing they test |
| 26 calendar items (§4) | 5 | The other 21 reference systems that do not exist |
| Canary at 5% for 15 minutes (§3) | Deploy, smoke-test, roll back on failure | Canary needs traffic volume to be statistically meaningful |
| Monthly restore drill (§8) | Applies from Stage 1 | Nothing to restore before then |
| Quarterly load test (§12) | Applies from Stage 3 | No traffic model to test against |

**Keep verbatim, at every stage:** the secrets rules (§2), *mitigate before diagnosing*
(§6), blameless post-incident review (§6), *a backup is a rumour until it has been restored*
(§8), and *watch the quiet paths* (§10). None of these depend on scale, and all five are
the ones most often skipped by small teams.

---

## Open questions for Document A

Now tracked in [REQUIREMENTS.md](REQUIREMENTS.md#open-decisions), where each is mapped to
the requirement IDs it blocks. Retained here for continuity:

1. ~~Is this Furniro, or a separate larger build?~~ **Answered 2026-09-07: Furniro is the
   system.** It grows into the full scope Doc B assumes — warehouse, ERP/PIM, carriers and
   payments included. This makes Stages 1–4 the plan of record and materially raises what
   Stage 0 must get right, since everything later is built on it.
2. Which payment provider, and single or dual gateway? §7 R3 assumes a secondary exists.
3. Own fulfilment or third-party? Determines whether §7 R8/R9 ever apply.
4. Search: database queries, or a dedicated cluster? §5 sets a 60-second index-staleness
   SLO, which implies a cluster.
5. Which market and currency? The UI renders `Rp` and `Rs` on the same card, and §11's
   retention periods depend on jurisdiction.
6. Team size and budget. Every reduction above turns on this single answer.

---

*Assessed against Document B Rev 1.0. Revisit at each stage boundary, and after any change
that turns a ⏳ into a ✅.*
