# Completion plan

**Baseline:** [REQUIREMENTS.md](REQUIREMENTS.md) records 18 built, 13 partial and 103 open
requirements across 20 modules. This plan covers the full documented scope. A first trading
release is a milestone within it, not completion of all 134 requirements.

**Architecture:** Build commerce inside Furniro's existing modular monolith, as decided in
[ADR 0015](decisions/0015-build-commerce-in-furniro.md). Furniro owns checkout, totals,
orders and inventory; an external payment processor collects online payments. Shopify
setup is no longer required. Follow the boundaries in [MODULES.md](MODULES.md) and mark
requirements complete only after their behavior is verified.

## Completion rules

1. Track each requirement ID in [REQUIREMENTS.md](REQUIREMENTS.md); update its status and
   evidence when behavior is verified. Keep module boundaries in [MODULES.md](MODULES.md).
2. For each milestone, complete the relevant code, provider configuration, operational
   procedure and end-to-end verification together. Record any decision that changes the
   architecture in `docs/decisions/`.
3. Never use the current IDR catalogue amounts as PKR amounts or let the browser calculate
   the amount charged. Furniro's server must authoritatively calculate checkout totals.
4. Run `Frontend: npm run verify && npm run e2e`, `Backend: npm test && npm run
   completeness && npm run smoke`, plus the milestone-specific checks before marking work
   done. `smoke` needs a running local API. For a deployed release, run `npm run
   smoke:deploy` with the actual public origins.

## Milestone 1 — secure and deploy the current storefront

**Modules:** `security`, `platform`, `catalogue`, `content`.

- Rotate the database password and retire the unused legacy anon key after checking other
  consumers, following [secret rotation](runbooks/secret-rotation.md). Do not copy unused
  Supabase credentials into Render.
- Connect the Render Blueprint, configure the public origins and API CORS allowlist, deploy
  API before storefront, and run the [deployment smoke check](runbooks/deployment.md).
- Add real uptime/error alert delivery and name an accountable maintainer and backup. Verify
  that an alert reaches a person and that rollback can restore the prior version.
- Finish the launch-critical catalogue/content gaps: accurate product media and metadata,
  privacy/legal pages, and live redirects/SEO checks. Keep the JSON product file as the sole
  local product source until the provider mapping is deliberately introduced.

**Exit:** Both Render tiers pass live smoke checks; security/alert ownership is recorded;
the storefront can be operated without claiming it can take orders.

**Progress (2026-10-10):** Removed unverified public contact details and inert footer help
items; footer navigation now reaches real pages. The build checks Render's required
discontinued-product redirects against the catalogue, and the deployment smoke check verifies
their live HTTP responses. Product pages also support validated optional SEO copy from the
catalogue. The deployment smoke check now covers live sitemap and robots delivery.
Credential rotation, first deployment, actual live verification, approved product
metadata, alert routing, owner assignment and reviewed legal copy remain open.
The blog listing now has a matching `/blog` URL and navigation label; its former `/about`
URL has a Render 301 rule that still needs live verification after deployment.
On 2026-10-10, a local Git check found `Backend/.env` ignored by
`Backend/.gitignore`, absent from tracked files and absent from available Git history.
This does not establish that the credentials are safe or rotated; the account-side
rotation remains the next required step.

## Milestone 2 — establish Furniro's durable commerce foundation

**Modules:** `catalogue`, `pricing`, `inventory`, `orders`, `payments`, `security`, `privacy`.

**Progress (2026-10-12):** The first [order migration](../Backend/db/README.md) and local
PostgreSQL tests cover order/item consistency, immutable snapshots, idempotency-key
uniqueness, denied public access and safe rollback. No production database or runtime
repository is connected. Payment attempts, stock reservations, application roles and
multi-client concurrency tests remain open.

**Progress (2026-10-13):** Migration 0002 adds online payment attempts bound to immutable
order amounts, retry restrictions for uncertain/successful charges, and atomic status
history. Local PostgreSQL tests pass. No gateway or runtime repository is connected;
stock reservations and full PostgreSQL concurrency checks are next.

**Progress (2026-10-13, inventory):** Migration 0003 adds stock counters, exact order-line
reservations, atomic reserve/release/consume updates, expiry guards and immutable history.
Disposable PostgreSQL tests cover insufficient stock, ignored duplicate inserts, rollback
and access controls. True multi-client concurrency, expiry jobs, stock adjustment workflows
and the runtime checkout repository remain open. No real stock has been seeded.

**Progress (2026-10-13, COD persistence):** An internal checkout service now writes COD
orders, immutable lines and stock reservations in one transaction through module interfaces.
Local tests verify rollback, identical retry replay and conflicting-key rejection. It uses
trusted server quotes; the quote producer, customer/delivery validation, production database
adapter, access controls and public endpoint are not built yet.

**Progress (2026-10-14, quote preparation):** Internal checkout preparation now resolves
catalogue prices, validates Pakistan delivery input and calculates safe integer totals
using a required server charge policy. It rejects browser money fields and non-PKR prices.
Approved PKR prices, actual shipping/tax policies, delivery persistence and inclusion in
the order idempotency fingerprint remain required before wiring this into public checkout.

**Progress (2026-10-14, delivery persistence):** Migration 0004 adds private delivery
storage owned by orders. Internal COD checkout now validates and stores delivery in the
same transaction as the order/stock reservation, and includes normalized delivery in
retry fingerprints. Local tests cover changed-address conflicts, rollback and access
configuration. Production roles, retention/deletion workflows, approved trading rules
and a production database adapter remain required before exposing checkout.

- Design versioned database migrations for orders, immutable order-item snapshots, payment
  attempts, inventory reservations and idempotency records. Define constraints, atomic
  writes, rollback and repository boundaries. Start with local database verification;
  do not use the existing live database credentials for unreviewed migrations.
- Retain the canonical JSON catalogue until a deliberate migration replaces it. Define
  stable product/variant references and server-owned integer PKR totals. Never accept a
  price, payment status or order total supplied by the browser.
- Obtain approved PKR prices using the [repricing runbook](runbooks/pkr-repricing.md).
  Confirm tax inclusion, shipping rates, returns and real stock or made-to-order lead
  times. Synthetic local test data is not approval of production prices or availability.
- Define protected operator access before exposing order/customer data or manual payment
  actions. Record retention, access and deletion/export requirements before collecting data.
- Verify an eligible direct online payment processor for the Pakistan merchant. Safepay
  remains a candidate; confirm direct integration, PKR settlement, fees, refunds and test
  mode. No Shopify account or Shopify mapping is needed.

**Exit:** Transactional persistence works locally with migrations and rollback verification;
repository and access boundaries are defined. Trading data and provider approval remain
explicit release gates. No public purchase action is enabled yet.

## Milestone 3 — complete one purchase path in Furniro

**Modules:** `cart`, `checkout`, `pricing`, `payments`, `orders`, `notifications`, `security`,
`privacy`; `inventory` for stocked goods.

1. Implement server-side cart validation and quote calculation from `{slug, quantity}`.
   Reject unknown/unavailable items; calculate PKR prices, tax and shipping from approved
   server data. Preserve the browser cart when checkout fails.
2. Build an idempotent guest COD checkout that atomically creates an order, snapshots its
   items/totals and reserves held stock. COD orders remain unpaid until a protected operator
   records collection. Test concurrent checkout, duplicate submission and stock release.
3. Build an authenticated operator order view and controlled fulfilment/cancellation
   transitions, with audit records. Configure order confirmations and delivery-failure handling.
4. Integrate hosted online payment collection against the persisted order amount. Verify
   webhook signatures, deduplicate deliveries and reconcile payment state. Browser redirects
   cannot mark orders paid. Define retry behavior after a timeout with an uncertain outcome.
5. Test both payment paths, changed prices, unavailable stock, failed/cancelled payment,
   duplicate requests/webhooks, confirmation, cancellation/refund and cart preservation on
   desktop and mobile. Publish reviewed privacy/terms before collecting customer data.

**Exit:** Both COD and online payment work end to end in a test environment with durable
orders and truthful payment state. Approved trading data, fulfilment, credentials and
release verification must be complete before enabling public checkout. Building COD first
is implementation sequencing; ADR 0013 still requires both methods at launch.

## Milestone 4 — operate the trading release safely

**Modules:** `platform`, `jobs`, `payments`, `orders`, `returns`, `notifications`,
`backoffice`, `support`, `privacy`.

- Implement or configure reconciliation, refund limits, returns workflow, delivery-failure
  handling, retry/dead-letter visibility and incident runbooks. Use provider facilities
  where they meet the documented requirement; add local jobs only for genuine gaps.
- Establish checkout/order/payment alerting, settlement checks, backups and a tested
  restore/rollback path for every data store Furniro actually owns. Review admin permissions,
  audit logs, support access and personal-data export restrictions.
- Test refund, failed notification, webhook outage/replay, provider outage and subject
  requests. Update the requirement ledger only with observed results.

**Exit:** The team can detect, investigate and recover from failed orders and payment
discrepancies, and can complete refunds and privacy requests within the adopted policies.

## Milestone 5 — finish the remaining documented scope

**Modules:** `identity`, `inventory`, `pricing`, `fulfilment`, `search`, `reviews`,
`backoffice`, `support`, `content`, `jobs`, `privacy` and remaining cross-cutting work.

- Add customer accounts and cross-device carts if required; keep guest checkout working.
  Complete promotions, coupons and price/tax display using Furniro's authoritative server
  calculation.
- Build or configure stock reservations/movement history, carrier rates/labels/tracking,
  return-to-origin handling and support tools according to the chosen fulfilment model.
- Improve discovery only when justified by measured needs: indexed search, synonyms,
  zero-result review, graceful fallback, reviews/moderation and CMS workflows.
- Complete operational requirements that depend on traffic or a database: retention/purge
  jobs, restore drills, access reviews, capacity/load tests, status page, WAF/bot controls,
  and other Stage 4 checks in [OPS_CONFORMANCE.md](OPS_CONFORMANCE.md#adoption-roadmap).

**Exit:** Every requirement in [REQUIREMENTS.md](REQUIREMENTS.md) is marked complete with
evidence, or its scope is explicitly changed by an approved decision. Reconcile the
requirement counts, module status, runbooks and changelog before declaring completion.

## Decisions and dependencies

| Decision or input | Needed before | Current state |
|---|---|---|
| Accountable maintainer and backup; credential rotation | Live deployment | Open |
| Approved PKR price list and tax treatment | Product migration, checkout | Open; validator/runbook ready |
| Fulfilment and inventory model | Checkout stock rules | Open |
| COD and online payment at launch; eligible online gateway account | Checkout | Methods chosen; Safepay candidate, account unverified |
| Durable commerce database and migrations | Orders and checkout | Open; owned by Furniro under ADR 0015 |
| ERP/PIM source of truth | Long-term catalogue and inventory sync | Open |

**Next implementation:** Milestone 2 database schema, migrations and transaction tests,
then the guest COD order path in Milestone 3. Deployment is deferred at the user's request;
Milestone 1 remains a release gate. Online payment follows COD implementation, and both
methods must pass before public launch. Account-specific facts and approved trading data
cannot be inferred from the sample catalogue.
