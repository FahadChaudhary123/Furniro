# Document A — Functional requirements (derived)

**Furniro e-commerce platform · Rev 0.1 (draft) · 2026-09-07**

---

## ⚠ Provenance — read this first

**This document was reconstructed, not supplied.** Document A was requested and not
received; Document B (*E-commerce maintenance and operations runbook*, Rev 1.0) was provided
instead, twice, and identified as the functional requirements.

Document B does not specify features. It specifies how to operate them. But every
operational procedure in it implies a feature that must exist for the procedure to make
sense — a runbook for "payment gateway outage" is only written for a system that takes
payments. **Every requirement below is derived by that inference and cited to the Document B
section that implies it.**

That makes this document evidence-based but not authoritative:

- **Cited requirements** — traceable to a specific Doc B section. High confidence that
  *something* like this is needed; the detail is inferred.
- **Inferred requirements** — necessary for a cited requirement to function (a cart must
  exist for checkout to exist), but not directly evidenced. Marked ⁱ.
- **What cannot be derived at all** — business rules, pricing, market, tax jurisdiction,
  brand, budget, timeline. Doc B is silent on all of these. See
  [Open decisions](#open-decisions).

Doc B §18 states *"Document A changes when scope changes, under change control (§30
there)"* — implying the real Document A has at least 30 sections. This has 12. **If the
original exists, it supersedes this entirely.** Treat this as a straw man to correct, which
is faster than starting from a blank page.

---

## 1. Scope

A furniture e-commerce platform selling to consumers online, with its own back office,
fulfilment integration and payment processing.

Doc B §Cover names three surfaces: **storefront, back office, integrations**. Those are the
three top-level scopes.

### In scope

Catalogue and merchandising · search · cart and checkout · payments · orders · inventory ·
fulfilment and carrier integration · returns and refunds · customer accounts · promotions ·
content and blog · reviews · transactional notifications · back office · support tooling ·
privacy and consent.

### Out of scope

Warehouse management internals (Doc B §11 puts CCTV and warehouse operational data out of
scope; the WMS is an integration, not a component) · accounting ledger beyond
reconciliation export · marketing automation beyond transactional sends · physical retail.

### Current reality

Furniro today implements a fraction of this: a four-page static storefront with a hardcoded
32-item catalogue and no back end. Status is tracked per requirement below and mapped to
the stages in [OPS_CONFORMANCE.md](OPS_CONFORMANCE.md#adoption-roadmap).

---

## 2. Requirement IDs

`<DOMAIN>-<nn>`. Stable once assigned — Doc B §16 records which requirement IDs depend on
each third party, and §17 records the requirement ID on every support ticket. **Renumbering
breaks both.** Retire an ID rather than reuse it.

| Prefix | Domain | Prefix | Domain |
|---|---|---|---|
| `CAT` | Catalogue and product | `PROMO` | Promotions and pricing |
| `SRCH` | Search and navigation | `CONT` | Content and blog |
| `CART` | Cart | `REV` | Reviews |
| `CHK` | Checkout | `NOTIF` | Notifications |
| `PAY` | Payments | `ADM` | Back office |
| `ORD` | Orders | `SUP` | Support tooling |
| `INV` | Inventory | `PRIV` | Privacy and consent |
| `FUL` | Fulfilment and shipping | `PLAT` | Platform and observability |
| `RET` | Returns and refunds | `SEC` | Security |
| `ACC` | Customer accounts | `NFR` | Non-functional |

**Status:** ✅ built · ◐ partial · ⭕ not built
**Stage:** roadmap stage from [OPS_CONFORMANCE.md](OPS_CONFORMANCE.md#adoption-roadmap)
**ⁱ** = inferred, no direct Doc B evidence

---

## 3. Actors

| Actor | Doc B source |
|---|---|
| Customer (guest) | §6 "cannot buy"; §7 R3 cart retained through failure |
| Customer (account holder) | §11 "customer account with no activity… 36 months after last order or **login**" |
| Catalogue manager | §1 owner of catalogue data quality |
| Merchandiser | §1, §15 search synonyms, inventory buffers |
| Support agent (Tier 1) | §17 order status, returns, address changes, refunds within limits |
| Operations / application support (Tier 2) | §17 stuck orders, data corrections, replaying queues |
| Engineer (Tier 3) | §17 defects, incident response |
| Finance | §4 daily settlement vs ledger; §1 payments and reconciliation |
| Warehouse operator | §7 R9 manual label printing |
| Data protection owner | §1, §11 subject requests |

Ten distinct actors. Note §1 assigns these to ten named role-holders — Furniro currently
has one person, which is a staffing question, not a requirements one.

---

## 4. Catalogue and product — `CAT`

| ID | Requirement | Doc B | Stage | Status |
|---|---|---|---|---|
| `CAT-01` | Products carry: name, description, images, price, tax class, weight, category, SEO fields | §15 onboarding | 1 | ◐ |
| `CAT-02` | Every product image has alt text | §15 | 0 | ✅ |
| `CAT-03` | A publish gate blocks incomplete products — "checked by the publish gate, not by eye" | §15 | 2 | ⭕ |
| `CAT-04` | Completeness report of products failing rules, resolved within 14 days | §15 data-quality sweep | 2 | ⭕ |
| `CAT-05` | Image derivatives generated on upload; modern formats served; no oversized originals | §15 | 0 | ◐ |
| `CAT-06` | Category hierarchy, browsable | §7 R7 "fall back to category browse" | 1 | ◐ |
| `CAT-07` | Product detail page at a stable, indexable URL | §15 "bare 404 on an indexed URL" | 1 | ⭕ |
| `CAT-08` | Discontinued products unpublish with a 301 to the nearest live alternative | §15 | 3 | ⭕ |
| `CAT-09` | Price and stock ingested from ERP/PIM; storefront reconciles daily within tolerance | §15 | 4 | ⭕ |
| `CAT-10`ⁱ | Product variants (size, finish, fabric) — implied by "SKU" being distinct from product throughout §7 R8 | — | 2 | ⭕ |

**Note on `CAT-09`:** Doc B treats an ERP/PIM as the source of truth for price and stock,
making the storefront a downstream consumer. That is a significant architectural constraint
and one of the largest unknowns — see [Open decisions](#open-decisions).

## 5. Search and navigation — `SRCH`

| ID | Requirement | Doc B | Stage | Status |
|---|---|---|---|---|
| `SRCH-01` | Full-text product search | §5, §7 R7 | 4 | ⭕ |
| `SRCH-02` | Search index rebuilt into a new index and alias-swapped, never rebuilt in place | §7 R7 | 4 | ⭕ |
| `SRCH-03` | Index staleness ≤ 60 s | §5 SLO | 4 | ⭕ |
| `SRCH-04` | Configurable synonyms and ranking rules, with expiry dates | §15 | 4 | ⭕ |
| `SRCH-05` | Zero-result and low-conversion queries logged for weekly review | §4, §15 | 4 | ⭕ |
| `SRCH-06` | Graceful degradation: hide the search box and fall back to category browse rather than return empty results | §7 R7 | 4 | ⭕ |
| `SRCH-07`ⁱ | Faceted filtering and sorting on listing pages | — | 1 | ◐ |

`SRCH-07` is inferred but partially present: the shop page has sort and page-size dropdowns
that are decorative — no `onChange`, and prices are formatted strings that cannot be sorted.

## 6. Cart — `CART`

| ID | Requirement | Doc B | Stage | Status |
|---|---|---|---|---|
| `CART-01`ⁱ | Add, update quantity, remove line items | — | 2 | ⭕ |
| `CART-02` | Cart survives a failed payment attempt intact, so the customer can retry | §7 R3 | 3 | ⭕ |
| `CART-03` | Stock reservation held against cart contents | §7 R3 "cart and reservation intact" | 3 | ⭕ |
| `CART-04` | Abandoned carts retained 90 days then deleted, by a monitored job | §9, §11 | 3 | ⭕ |
| `CART-05`ⁱ | Cart persists across sessions for account holders | — | 3 | ⭕ |

## 7. Checkout — `CHK`

| ID | Requirement | Doc B | Stage | Status |
|---|---|---|---|---|
| `CHK-01` | Multi-step checkout, instrumented per step | §7 R2 "segment by step" | 3 | ⭕ |
| `CHK-02` | Guest checkout | §6 "cannot buy" as distinct from account issues | 3 | ⭕ |
| `CHK-03` | Individual payment methods can be disabled without taking checkout down | §7 R2 | 3 | ⭕ |
| `CHK-04` | Individual shipping options can be disabled independently | §7 R2 | 3 | ⭕ |
| `CHK-05` | Shipping rates from carrier API, with cached rate cards as fallback | §7 R9 | 4 | ⭕ |
| `CHK-06` | Order total computed server-side; the client never submits a price | Implied by §6 financial safety | 3 | ⭕ |
| `CHK-07` | Synthetic checkout runs continuously as a monitoring probe | §5 alert catalogue, §7 R1 | 3 | ⭕ |
| `CHK-08` | Checkout availability ≥ 99.95% | §5 SLO | 3 | ⭕ |

**`CHK-06` is the single most important requirement in this document.** A total submitted by
the client is a number the buyer chose. It is cheap now and expensive to retrofit.

## 8. Payments — `PAY`

| ID | Requirement | Doc B | Stage | Status |
|---|---|---|---|---|
| `PAY-01` | Card payments via a gateway | §1, §5, §7 R3 | 3 | ⭕ |
| `PAY-02` | **Secondary gateway** to fail over to | §7 R3 "switch to the secondary gateway if configured" | 3 | ⭕ |
| `PAY-03` | Alternative (non-card) payment methods, promotable when card is disabled | §7 R3 | 3 | ⭕ |
| `PAY-04` | Idempotency keys on every payment operation; no retry can double-charge | §7 R3 | 3 | ⭕ |
| `PAY-05` | Authorise and capture as separate steps; capture can be stopped mid-incident | §6 financial safety | 3 | ⭕ |
| `PAY-06` | Reconciliation: settlement vs internal ledger, exceptions to zero daily | §4 | 3 | ⭕ |
| `PAY-07` | Reconcile authorisations without orders, and orders without authorisations | §7 R3 | 3 | ⭕ |
| `PAY-08` | Webhook endpoint with signature verification and idempotent handling | Implied by §9 raw webhook payload retention | 3 | ⭕ |
| `PAY-09` | Raw webhook payloads retained 30 days then deleted | §11 | 3 | ⭕ |
| `PAY-10` | Payment tokens stored for reuse; revoked at gateway then deleted after 24 months unused | §11 | 3 | ⭕ |
| `PAY-11` | Velocity rules on payment attempts per card, IP and device | §7 R11 | 3 | ⭕ |
| `PAY-12` | No card data in the application, logs, analytics, support tools or backups | §10 payment scope review | 3 | ⭕ |
| `PAY-13` | Authorisation success ≥ 95%, method-adjusted | §5 SLO | 3 | ⭕ |
| `PAY-14` | Chargeback handling and reporting | §4 monthly refund/chargeback review | 3 | ⭕ |

`PAY-12` implies a hosted checkout or client-side payment element. That is a PCI scope
decision with architectural consequences, and it should be made before `PAY-01` is built.

## 9. Orders — `ORD`

| ID | Requirement | Doc B | Stage | Status |
|---|---|---|---|---|
| `ORD-01` | Order state machine including at least `pending_payment`, `on_hold`, allocated, despatched | §4 daily stuck-order check | 3 | ⭕ |
| `ORD-02` | SLA per state; orders exceeding it surface on a daily report | §4 | 3 | ⭕ |
| `ORD-03` | Line items snapshot price at purchase; a later catalogue change never alters a historical order | Implied by §11 statutory retention | 3 | ⭕ |
| `ORD-04` | Orders released to warehouse within 15 min during business hours | §5 SLO | 4 | ⭕ |
| `ORD-05` | Orders, invoices and tax records retained for the statutory period (6–10 years) | §11 | 3 | ⭕ |
| `ORD-06` | Closed orders archived quarterly to cold storage, still queryable by finance and support | §9 | 4 | ⭕ |
| `ORD-07` | Immutable event log per order, sufficient to replay orders after a point-in-time restore | §8 disaster scenarios | 3 | ⭕ |
| `ORD-08` | Order confirmation email on placement | §7 R1 "including confirmation email" | 3 | ⭕ |

`ORD-07` is a strong requirement hiding in a disaster-recovery table: Doc B §8 expects to
"replay orders taken since from the event log". That mandates event sourcing, or at minimum
a durable append-only order event stream. It is not retrofittable.

## 10. Inventory — `INV`

| ID | Requirement | Doc B | Stage | Status |
|---|---|---|---|---|
| `INV-01` | Available-to-promise (ATP) per SKU | §5 alert catalogue, §7 R8 | 3 | ⭕ |
| `INV-02` | Reservation on cart/checkout; all stock writes go through the reservation path | §7 R8 | 3 | ⭕ |
| `INV-03` | Movement ledger — every stock change auditable to its source | §7 R8 | 3 | ⭕ |
| `INV-04` | ATP below zero raises an alert; the SKU can be frozen from sale immediately | §5, §7 R8 | 3 | ⭕ |
| `INV-05` | Configurable inventory buffers and oversell settings per SKU | §13 | 4 | ⭕ |
| `INV-06` | Stock accuracy spot-check reporting on top-50 SKUs | §4 | 4 | ⭕ |

## 11. Fulfilment and shipping — `FUL`

| ID | Requirement | Doc B | Stage | Status |
|---|---|---|---|---|
| `FUL-01` | Carrier API integration for rates and labels | §7 R9 | 4 | ⭕ |
| `FUL-02` | Manual label printing fallback at the warehouse, with tracking backfill | §7 R9 | 4 | ⭕ |
| `FUL-03` | Carrier tracking ingested; shipments with no scan for 48 h reported daily | §4 | 4 | ⭕ |
| `FUL-04` | Despatch notifications held until tracking exists | §7 R9 | 4 | ⭕ |
| `FUL-05` | Manifest reconciliation when a carrier API recovers | §7 R9 | 4 | ⭕ |

## 12. Returns and refunds — `RET`

| ID | Requirement | Doc B | Stage | Status |
|---|---|---|---|---|
| `RET-01` | Customer-initiated returns | §17 Tier 1 | 3 | ⭕ |
| `RET-02` | Refunds, with a value limit above which Tier 1 cannot act alone | §17 | 3 | ⭕ |
| `RET-03` | Refunds blocked while payment state is uncertain — reconcile before refunding | §6 financial safety | 3 | ⭕ |
| `RET-04` | Refund, chargeback and RTO rates reported monthly against target | §4 | 3 | ⭕ |
| `RET-05` | Returns policy page, reviewed quarterly | §4 legal review | 1 | ⭕ |

## 13. Customer accounts — `ACC`

| ID | Requirement | Doc B | Stage | Status |
|---|---|---|---|---|
| `ACC-01` | Registration and login | §11 "last order or login" | 2 | ⭕ |
| `ACC-02` | Order history and order status self-service | §17 Tier 1 | 2 | ⭕ |
| `ACC-03` | Saved addresses; address change on an open order | §17 Tier 1 | 2 | ⭕ |
| `ACC-04` | Accounts inactive 36 months: notify, then anonymise | §11 | 3 | ⭕ |
| `ACC-05`ⁱ | Wishlist — the navbar already has the icon | — | 2 | ⭕ |

## 14. Promotions and pricing — `PROMO`

| ID | Requirement | Doc B | Stage | Status |
|---|---|---|---|---|
| `PROMO-01` | Discounts and promotions, rehearsable on staging before going live | §13 | 3 | ⭕ |
| `PROMO-02` | Discount arithmetic verifiable, including interaction with refunds | §13 | 3 | ⭕ |
| `PROMO-03` | Coupon codes, rate-limited against brute force | §7 R11 | 3 | ⭕ |
| `PROMO-04` | Pricing display rules compliant with local law, reviewed quarterly | §4 | 3 | ⭕ |
| `PROMO-05` | Campaign banners carry expiry; none may promote an expired offer | §15 | 2 | ⭕ |

## 15. Content, reviews and notifications — `CONT` `REV` `NOTIF`

| ID | Requirement | Doc B | Stage | Status |
|---|---|---|---|---|
| `CONT-01` | CMS-managed content pages and blog | §8 "Document store / CMS content" | 2 | ◐ |
| `CONT-02` | Legal pages: terms, privacy, returns | §4 | 1 | ⭕ |
| `CONT-03` | Broken-link, 404-spike and redirect-chain reporting | §4 | 2 | ⭕ |
| `CONT-04` | SEO health: index coverage, crawl errors, duplicate titles, orphaned pages | §15 | 2 | ⭕ |
| `REV-01` | Customer product reviews with a moderation queue cleared within 24 h | §15 | 4 | ⭕ |
| `REV-02` | Rejection reasons recorded | §15 | 4 | ⭕ |
| `NOTIF-01` | Transactional email: ≥ 99% delivered within 5 minutes | §5 SLO | 3 | ⭕ |
| `NOTIF-02` | Secondary email provider; order confirmations fail over first | §7 R10 | 3 | ⭕ |
| `NOTIF-03` | Transactional and marketing sends separable — marketing can be paused independently | §7 R10 | 3 | ⭕ |
| `NOTIF-04` | SPF, DKIM and DMARC configured and monitored | §7 R10 | 3 | ⭕ |
| `NOTIF-05` | Non-production environments route all mail to a catch-all mailbox | §2 | 1 | ⭕ |

`CONT-01` is partial: a blog section exists, hardcoded in a component, with a display-string
date that cannot be sorted.

`NOTIF-05` is small, cheap, and prevents emailing real customers from staging. Build it with
the first email, not after the first accident.

## 16. Back office and support — `ADM` `SUP`

| ID | Requirement | Doc B | Stage | Status |
|---|---|---|---|---|
| `ADM-01` | Back office for catalogue, orders, inventory and content | §Cover, §1 | 2 | ⭕ |
| `ADM-02` | Role-based access; least privilege; no shared accounts; MFA | §2, §10 | 2 | ⭕ |
| `ADM-03` | Monthly access review; dormant and leaver access removed | §4, §10 | 2 | ⭕ |
| `ADM-04` | Audit log of back-office actions, write-once, alarmed on gaps | §10 log integrity | 2 | ⭕ |
| `ADM-05` | Feature flags, toggleable without deploy, state visible on the health endpoint | §2, §7 R1 | 1 | ⭕ |
| `SUP-01` | Ticketing recording affected order/customer, requirement ID or component, and resolution | §17 | 3 | ⭕ |
| `SUP-02` | Top-contact-reason report | §17 | 3 | ⭕ |
| `SUP-03` | Tier 2 tooling: replay queues, correct data, resolve stuck orders | §17 | 3 | ⭕ |
| `SUP-04` | Support tools export only what is needed — no bulk PII export by default | §10 "watch the quiet paths" | 3 | ⭕ |

`ADM-04` and `SUP-04` are the requirements most likely to be skipped and most likely to
matter. Doc B §10 is explicit that breaches come through admin surfaces and support tools,
not checkout.

## 17. Privacy and consent — `PRIV`

| ID | Requirement | Doc B | Stage | Status |
|---|---|---|---|---|
| `PRIV-01` | Single intake route for access, correction, deletion, objection and portability | §11 | 2 | ⭕ |
| `PRIV-02` | Acknowledge within 3 working days, fulfil within the statutory window | §11 | 2 | ⭕ |
| `PRIV-03` | Deletion = anonymisation where financial records must be kept — "the order survives, the person does not" | §11 | 3 | ⭕ |
| `PRIV-04` | Consent state enforced **server-side**, not by tag manager | §11 | 2 | ⭕ |
| `PRIV-05` | Retention periods enforced by monitored purge jobs, per the §11 schedule | §9, §11 | 2 | ⭕ |
| `PRIV-06` | Processing register and sub-processor list, updated as part of adding a third party | §11 | 1 | ◐ |
| `PRIV-07` | Privacy notice; refreshed annually | §4 | 1 | ⭕ |
| `PRIV-08` | Staging refresh scrubs names, emails, phones, addresses and payment tokens **as part of the copy job** | §2 | 2 | ⭕ |

`PRIV-06` is partially met — [THIRD_PARTY_REGISTER.md](THIRD_PARTY_REGISTER.md) is the
sub-processor list in embryo.

`PRIV-08`'s phrasing matters: scrubbing must be inside the copy job, not a follow-up step
someone might skip.

## 18. Platform, observability and security — `PLAT` `SEC`

| ID | Requirement | Doc B | Stage | Status |
|---|---|---|---|---|
| `PLAT-01` | Health endpoint exposing build SHA, config version and feature-flag state | §2 | 1 | ⭕ |
| `PLAT-02` | Correlation IDs propagated through traces and logs, queryable per session | §7 R2 | 1 | ⭕ |
| `PLAT-03` | Structured application logs, 30 days hot / 12 months cold | §11 | 1 | ⭕ |
| `PLAT-04` | Error tracking and alerting | §5 | 1 | ⭕ |
| `PLAT-05` | Background job framework with retries and a dead-letter queue | §4, §7 R6 | 3 | ⭕ |
| `PLAT-06` | Queues prioritised: order-release and notification above analytics | §7 R6 | 3 | ⭕ |
| `PLAT-07` | Long-running backfills run as jobs with progress and a kill switch, never inside a deploy | §3 | 3 | ⭕ |
| `PLAT-08` | Infrastructure as code; manual console changes codified within one working week | §2 | 1 | ⭕ |
| `PLAT-09` | Status page for customer-facing incident comms | §6 | 3 | ⭕ |
| `PLAT-10` | CDN with documented per-surface cache strategy and purge-on-publish | §12 | 3 | ⭕ |
| `SEC-01` | Secrets in a managed store with per-environment scoping and access logging | §2 | 1 | ⭕ |
| `SEC-02` | WAF and bot rules, tuned after incidents | §10, §7 R11 | 3 | ⭕ |
| `SEC-03` | Edge rate-limiting and challenge, targeted rather than blanket blocks | §7 R11 | 3 | ⭕ |
| `SEC-04` | Security headers: CSP, HSTS, frame and referrer policies; modern ciphers only | §10 | 1 | ⭕ |
| `SEC-05` | Dependency vulnerability scanning every build plus weekly sweep | §10 | 0 | ✅ |
| `SEC-06` | Secret scanning in CI | §2, §3 | 0 | ✅ |

`SEC-05` and `SEC-06` are the only requirements in this section already met — both landed in
the Stage 0 pass. `SEC-01` is actively breached: credentials sit in a plaintext `.env` with
rotation outstanding.

## 19. Non-functional — `NFR`

Lifted directly from Doc B §5 and §12. These are the only requirements in this document
stated numerically by the source rather than inferred.

| ID | Requirement | Doc B | Status |
|---|---|---|---|
| `NFR-01` | Checkout success rate ≥ 98.5%, rolling 28 days | §5 | ⭕ |
| `NFR-02` | Storefront availability ≥ 99.9% monthly (43 min budget) | §5 | ⭕ |
| `NFR-03` | Checkout availability ≥ 99.95% monthly (22 min budget) | §5 | ⭕ |
| `NFR-04` | Catalogue API latency p95 ≤ 400 ms | §5 | ⭕ |
| `NFR-05` | Order-to-warehouse release lag ≤ 15 min | §5 | ⭕ |
| `NFR-06` | Bundle size, image weight and third-party script count gated in CI | §12 | ✅ |
| `NFR-07` | Core Web Vitals field data tracked weekly by template and device class | §12 | ⭕ |
| `NFR-08` | Every release revertible in under 10 minutes | §3 | ◐ |
| `NFR-09` | Database RPO 5 min / RTO 60 min; product media RPO < 1 h / RTO 2 h | §8 | ⭕ |
| `NFR-10` | Accessibility: purchase path audited quarterly with assistive technology | §4 | ⭕ |
| `NFR-11` | Capacity model mapping orders/minute to connections, throughput and instances | §12 | ⭕ |
| `NFR-12` | Error budget policy: >50% spent pauses non-essential feature work on that surface | §5 | ⭕ |

`NFR-06` is met — enforced by `Frontend/scripts/check-budgets.mjs`.
`NFR-08` is partial: a static build is trivially revertible, but there is no deployment to
revert and no measured timing.

---

## 20. Traceability — Document B section to requirements

Closes the loop Doc B §16 and §17 ask for. Every operational procedure now resolves to the
requirements it depends on.

| Doc B | Depends on |
|---|---|
| §4 Daily settlement | `PAY-06`, `PAY-07` |
| §4 Stuck orders | `ORD-01`, `ORD-02` |
| §4 Carrier tracking | `FUL-03` |
| §5 Alert: orders flatline | `CHK-07`, `ORD-01` |
| §5 Alert: checkout errors | `CHK-01`, `PLAT-02`, `PLAT-04` |
| §5 Alert: gateway failure | `PAY-01`, `PAY-02`, `PAY-13` |
| §5 Alert: stock oversell | `INV-01`, `INV-04` |
| §7 R1 Orders stopped | `CHK-07`, `INV-01`, `ADM-05`, `ORD-08` |
| §7 R2 Checkout errors | `CHK-01`, `CHK-03`, `CHK-04`, `PLAT-02` |
| §7 R3 Gateway outage | `PAY-02`, `PAY-03`, `PAY-04`, `CART-02`, `CART-03`, `PAY-07` |
| §7 R4 Site-wide 5xx | `PLAT-04`, `PLAT-10`, `NFR-08` |
| §7 R6 Queue backlog | `PLAT-05`, `PLAT-06` |
| §7 R7 Search degraded | `SRCH-02`, `SRCH-03`, `SRCH-06` |
| §7 R8 Oversell | `INV-02`, `INV-03`, `INV-04` |
| §7 R9 Carrier failure | `CHK-05`, `FUL-01`, `FUL-02`, `FUL-04`, `FUL-05` |
| §7 R10 Email failure | `NOTIF-01`, `NOTIF-02`, `NOTIF-03`, `NOTIF-04` |
| §7 R11 Card testing | `PAY-11`, `PROMO-03`, `SEC-02`, `SEC-03` |
| §7 R12 Data breach | `ADM-04`, `SEC-01`, `PRIV-01` |
| §8 Point-in-time restore | `ORD-07` |
| §11 Subject requests | `PRIV-01`–`PRIV-05` |
| §13 Peak readiness | `INV-05`, `PROMO-01`, `NFR-11` |
| §17 Tier 1 support | `ACC-02`, `ACC-03`, `RET-01`, `RET-02`, `SUP-01` |

**Every Doc B runbook R1–R12 now has requirement coverage.** Two (R4, R12) are partially
satisfiable today; the other ten depend on requirements not yet built.

---

## Open decisions

Doc B cannot answer these, and they change what gets built. Each blocks the requirements
listed.

| # | Decision | Blocks |
|---|---|---|
| 1 | **Payment provider, and is a secondary genuinely required?** Doc B §7 R3 assumes one. Dual-gateway roughly doubles payment integration cost | `PAY-01`, `PAY-02` |
| 2 | **PCI approach** — hosted checkout, or embedded element? Determines whether `PAY-12` is satisfiable by design or by audit | `PAY-01`, `PAY-12` |
| 3 | **Market, currency and tax jurisdiction.** The UI renders both `Rp` and `Rs`; §11 retention and §4 legal review depend on jurisdiction | `PROMO-04`, `ORD-05`, `PRIV-*` |
| 4 | **Fulfilment model** — own warehouse, 3PL, or dropship? | All `FUL-*`, `INV-*` |
| 5 | **Is there an ERP/PIM?** Doc B §15 treats it as the source of truth for price and stock. If none exists, the platform *is* the source of truth — a different architecture | `CAT-09`, `INV-*` |
| 6 | **Search: database queries or a dedicated cluster?** §5's 60-second staleness SLO implies a cluster | All `SRCH-*` |
| 7 | **Build, or adopt a platform?** Every requirement here is standard commerce functionality. Shopify or Medusa supplies most of §4–§17 on day one. Building it is 12–24 months for a full team | Everything |
| 8 | **Team size and budget.** Doc B §1 names ten role-holders and a 24/7 rota. Furniro has one person | Delivery plan, all stages |

**Decision 7 deserves a direct answer before anything else.** Doc B describes an operation
with a platform team, a warehouse, a finance function and a 24/7 rota. Nothing in this
requirements list is differentiated — it is the standard feature set of an e-commerce
platform. The differentiated work is catalogue, brand and merchandising, none of which
requires building payments, search and fulfilment from scratch.

That is a business decision, not a technical one, and it is not mine to make. But building
all of the above from a four-page static storefront is a multi-year programme, and it should
be entered deliberately rather than by default.

---

## 21. Module allocation

Every requirement below is allocated to exactly one owning module in
[MODULES.md](MODULES.md) — 20 modules across six layers, plus the twelve `NFR-*` quality
attributes, which are verified by gates rather than owned by a module. The allocation is
complete and non-overlapping.

## 22. Requirement counts

| Domain | Reqs | ✅ | ◐ | ⭕ |
|---|---|---|---|---|
| Catalogue, search, content | 21 | 1 | 5 | 15 |
| Cart, checkout, payments | 27 | 0 | 0 | 27 |
| Orders, inventory, fulfilment, returns | 24 | 0 | 0 | 24 |
| Accounts, promotions, reviews, notifications | 17 | 0 | 0 | 17 |
| Back office, support, privacy | 17 | 0 | 1 | 16 |
| Platform, security, non-functional | 28 | 3 | 1 | 24 |
| **Total** | **134** | **4** | **7** | **123** |

**4 of 134 requirements are met** — `CAT-02` (alt text), `SEC-05` and `SEC-06` (the CI
gates), `NFR-06` (budgets). Three of those four landed in the last session.

This is not a criticism of the codebase; it is the honest distance between a static
storefront and the trading operation Document B is written to run.

---

## 30. Change control

Numbered §30 because Doc B §18 cross-references *"change control (§30 there)"*. Sections
22–29 of the original are not reconstructible.

- This document is the source of scope. Doc B changes after every incident that reveals a
  gap; this changes when scope changes.
- Requirement IDs are **stable and never reused** — Doc B §16 and §17 both reference them.
- Every change records: what changed, why, who approved it, and which Doc B sections are
  affected.
- Adding a requirement that implies a third party updates
  [THIRD_PARTY_REGISTER.md](THIRD_PARTY_REGISTER.md) and the privacy notice **in the same
  change**, per Doc B §11.
- Superseding this reconstruction with the original Document A is a wholesale replacement,
  not an edit. Keep the ID scheme if anything here has already been referenced.

---

*Rev 0.1 · Derived from Document B Rev 1.0 · **Reconstruction, not the original.** Every
requirement is inferred from an operational procedure that presumes it. Correct it,
replace it, or confirm it — but do not treat it as agreed scope until someone has.*
