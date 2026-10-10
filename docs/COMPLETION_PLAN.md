# Completion plan

**Baseline:** [REQUIREMENTS.md](REQUIREMENTS.md) records 18 built, 13 partial and 103 open
requirements across 20 modules. This plan covers the full documented scope. A first trading
release is a milestone within it, not completion of all 134 requirements.

**Architecture:** Keep the existing storefront and read API. Use a commerce platform for
checkout, payments, orders and inventory as decided in
[ADR 0012](decisions/0012-adopt-commerce-platform.md). The modules in
[MODULES.md](MODULES.md) are capability and ownership boundaries; they do not all require
new local services. Mark a requirement complete only after the selected platform and Furniro's
integration satisfy its acceptance criteria in a working environment.

## Completion rules

1. Track each requirement ID in [REQUIREMENTS.md](REQUIREMENTS.md); update its status and
   evidence when behavior is verified. Keep module boundaries in [MODULES.md](MODULES.md).
2. For each milestone, complete the relevant code, provider configuration, operational
   procedure and end-to-end verification together. Record any decision that changes the
   architecture in `docs/decisions/`.
3. Never use the current IDR catalogue amounts as PKR amounts or let the browser calculate
   the amount charged. The commerce platform must authoritatively calculate checkout totals.
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
their live HTTP responses. Credential rotation, first deployment, actual live verification,
alert routing, owner assignment and reviewed legal copy remain open.

## Milestone 2 — settle the trading design and data

**Modules:** `catalogue`, `pricing`, `inventory`, `fulfilment`, `privacy`.

- Decide whether launch requires online payment or permits cash on delivery; confirm the
  merchant's eligible PKR gateway, settlement, refunds and test mode in a real account.
  Recheck the evidence in [provider comparison](COMMERCE_PLATFORM_COMPARISON.md) before
  choosing Shopify or Medusa. Record the provider decision and actual fees/limits.
- Decide stocked versus made-to-order versus dropship goods, shipping regions/rates,
  tax treatment, returns policy, and whether an ERP/PIM is authoritative. Stocked goods
  require inventory reservation before checkout; made-to-order goods still need an honest
  availability and lead-time policy.
- Obtain approved PKR prices for every published product and apply them using the
  [PKR repricing runbook](runbooks/pkr-repricing.md). Record tax inclusion and approved
  comparison prices. Do not relabel IDR numbers.
- Configure products/variants in the platform and validate the complete slug-to-variant
  mapping with `npm run mapping -- --check <file>`. Compare currency, price, image and
  availability against the provider API separately; the local validator checks mapping
  coverage and duplicate IDs only.
- Define the data boundary: which system owns prices, availability, customer records and
  orders; how updates reach the storefront; and how deletion/export requests cross it.

**Exit:** A selected provider is demonstrably usable for a Pakistan-only PKR checkout;
all published products have approved PKR prices and verified provider variants; tax,
shipping, fulfilment and data ownership are documented. No purchase action is enabled yet.

## Milestone 3 — complete one purchase path

**Modules:** `cart`, `checkout`, `payments`, `orders`, `notifications`, `security`,
`privacy`; `inventory` if goods are stocked.

- Map `{slug, quantity}` cart lines to provider variants on the server, reject unmapped
  or unavailable items, and use the platform's current authoritative prices. Preserve the
  cart on checkout failure. Make checkout idempotent and show a clear success/failure state.
- Use provider-owned checkout and payment collection. Verify order creation, payment
  status, webhook authentication, duplicate webhook handling and order-state transitions.
  Avoid collecting card data in Furniro code or logs.
- Configure customer-facing order confirmation and an operational view of orders. Provide
  a documented manual fulfilment path if carrier automation is deferred.
- Publish the privacy notice and consent behavior before collecting new customer data;
  map the provider's retention, access and deletion/export capabilities into the processing
  register. Restrict admin access and enable MFA.
- Test guest purchase in a non-production environment: success, declined/cancelled payment,
  changed price, unavailable item, duplicate request/webhook, order confirmation and
  refund/cancellation. Exercise desktop and mobile browser flows, accessibility checks,
  and the actual PKR amount charged.

**Exit:** A test customer can place one real-format order in PKR, see a truthful outcome,
and an operator can find and fulfil or refund it. All money and order states reconcile
between Furniro and the platform. Only then enable checkout for customers.

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
  Complete promotions, coupons and price/tax display using the platform's authoritative
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
| Fulfilment and inventory model | Provider setup, checkout stock rules | Open |
| Online gateway or cash-on-delivery launch; eligible provider account | Platform choice, checkout | Open |
| Commerce platform and verified variant mapping | Purchase integration | Platform approach accepted; provider open |
| ERP/PIM source of truth | Long-term catalogue and inventory sync | Open |

The immediate implementation sequence is **Milestone 1**, followed by the decisions and
data work in **Milestone 2**. Milestones 3–5 depend on those inputs and should be broken into
small reviewable changes once the provider and fulfilment model are known.
