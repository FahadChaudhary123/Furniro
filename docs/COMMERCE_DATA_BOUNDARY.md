# Commerce data boundary

**Status:** planned Furniro-owned commerce, 2026-10-12.
[ADR 0015](decisions/0015-build-commerce-in-furniro.md) replaces the Shopify approach.
There is still no running database, checkout, payment or order implementation.

## Authority by data type

| Data | Current authority | Intended trading authority |
|---|---|---|
| Product description, slug, category and media key | Canonical catalogue JSON | Furniro catalogue; migrate deliberately if database ownership is introduced |
| Display price | IDR integer amounts in the canonical catalogue | Approved PKR prices owned by Furniro pricing/catalogue |
| Discounts, tax, shipping and amount charged | None | Furniro server pricing and checkout calculation |
| Stock and reservations | None | Furniro inventory, with transactional concurrency control |
| Guest cart | Browser storage with `{slug, quantity}` only | Same input; validated and repriced by the server at checkout |
| Customer and delivery details | None | Protected Furniro order records; account records only when identity is built |
| Orders and immutable item/total snapshots | None | Furniro orders in transactional storage |
| Payment attempts and order payment state | None | Furniro payments, reconciled with verified processor events; COD collection recorded by an authorized operator |
| Card details | None | Hosted payment processor; never Furniro forms, storage or logs |
| Blog posts | Canonical content JSON | Furniro content until a deliberate CMS decision |

The only current product definition remains
`Backend/src/modules/catalogue/data/products.json`. Do not create a second mutable copy.
An immutable order-item snapshot records what was bought; it does not become a catalogue.
No Shopify mapping is needed. ERP/PIM ownership remains a separate open decision.

## Purchase flow to implement

1. Validate `{slug, quantity}` against published products and approved PKR prices, tax,
   shipping and real availability. Do not infer PKR values from IDR or trust browser totals.
2. Atomically create the order, immutable item/total snapshots and required stock
   reservations under a durable idempotency key. A repeated request must not create a
   second order; reject incompatible reuse of the same key.
3. COD begins unpaid. Record collection through a protected, audited operator action.
   For online payment, persist a payment attempt before contacting the processor using
   the server's immutable order amount. Handle uncertain outcomes through reconciliation.
4. Verify processor signatures and deduplicate events before changing payment state.
   A browser return alone cannot establish payment. Do not retain raw card data or log
   raw customer/provider payloads. Use durable retry/event records where required.
5. Preserve the cart on failure. Clear only the successfully ordered lines after a verified
   order outcome, including an accepted unpaid COD order. Support cancellation, stock
   release and refunds with explicit transitions and audit records.

## Privacy and operating responsibilities

Furniro owns database access, backups, recovery, retention and customer export/deletion
workflows. Before collecting new customer data, update
[PROCESSING_REGISTER.md](PROCESSING_REGISTER.md) and publish reviewed privacy/terms.
Record the actual database, payment and notification services in
[THIRD_PARTY_REGISTER.md](THIRD_PARTY_REGISTER.md), including access and support ownership.

## Remaining inputs

- Database schema, migrations, repository interfaces and verified transactions.
- Approved PKR prices, tax, shipping rates, returns and fulfilment rules.
- Real stock or lead times; unverified availability must not permit purchase.
- Protected operator identity, permissions and audit behavior.
- Eligible direct PKR payment processor and verified merchant account; Safepay is a candidate.
- Notification delivery and operational ownership. No requirement becomes complete from
  this design alone; verify behavior against the completion plan.
