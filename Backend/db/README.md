# Commerce database foundation

## Internal COD collection

Migration 0007 adds private, immutable `cod_collections` owned by payments, bound to an
order's exact total, currency and COD method. `createCodCollection(db)` in checkout takes
`{orderId, actorId, idempotencyKey, amountMinor, receiptReference}` from an authorized
operator context (authentication is still absent). `amountMinor` is observed cash and must
match the full stored total; it cannot change the price. The order must be delivered with
a delivery audit event and consumed stock for every line. Delivery alone creates no payment.

Receipt references are globally unique internal cash-receipt codes: 1–100 ASCII letters,
digits, dots, slashes, underscores or hyphens, starting with a letter/digit, normalized to
uppercase. Do not enter names, phone numbers or addresses. These are not carrier tracking
codes. A repeated key with the same order/amount/receipt returns the original collection;
a different key for the order, a reused receipt or a conflicting request is rejected.
Retries preserve the first operator attribution. All callers still need authorization.

This records operator evidence only; it neither moves money nor confirms courier remittance
or bank settlement. Partial collections, overpayments, corrections, reversals, refunds,
retention and reconciliation workflows remain unimplemented. No endpoint, UI or live
database connection is added. The rollback refuses populated collection history.

## Internal COD fulfilment

Migration 0006 permits allocation, despatch and delivery audit events. The checkout
interface `createCodFulfilment(db)` accepts `{orderId, actorId, targetStatus}` from a
trusted, authorized operator caller (authentication is not connected). Only COD orders
follow `on_hold -> allocated -> despatched -> delivered`. Each operation locks the order
and all its reservations, requires complete line coverage, and commits state, audit and
inventory changes together. Allocation keeps active unexpired holds; despatch consumes
them. Holds are not extended automatically. Delivery requires consumed reservations and
does not imply payment collection. Retries at the same state verify stock/history and
return `replayed: true`; backward retries after later progression are rejected.

No endpoint, carrier tracking, shipment record, notification or payment collection is
added. Cancellation accepts on-hold and allocated COD orders before despatch. These are application
guards; privileged direct SQL can bypass them. True PostgreSQL concurrent transitions
and deadlock retry behavior still need verification. Rollback refuses progressed orders
or fulfilment events so audit history is preserved.

## Internal COD cancellation

Migration 0005 adds private, append-only order events. `createCodCancellation(db)` takes
`{orderId, actorId}`; the actor UUID must come from a trusted, authorized operator context,
not a browser field. Authorization is not implemented and this has no endpoint or UI.
It locks the order, accepts on-hold or audited allocated COD orders, releases reservations in product order
and records cancellation in one transaction. Conflicting fulfilment history or consumed
stock fails the transaction; despatched/delivered orders require a future returns workflow. Retries
preserve the original audit actor and event. It does not cancel online payments, refund,
delete delivery data or implement the full order state machine. The down migration refuses
populated history. Production roles, audit retention and multi-client concurrency verification
are still required; direct database owners can bypass application transition guards.

## Internal quote preparation

`createCheckoutQuote` in the checkout public interface accepts `{items, delivery}`.
Items contain only `{slug, quantity}`. Catalogue reads use its public interface and must
return PKR prices; current IDR prices cannot be used. A required server `calculateCharges`
policy receives immutable lines, normalized delivery and subtotalMinor, returning explicit
discountMinor, shippingMinor and taxMinor integers. No production policy or rates exist yet.
The result contains `{quote, delivery}`; this is not an endpoint or a persisted quote.
Delivery shape validation does not verify phone ownership or shipping coverage.

Migration 0004 adds private `order_delivery` storage through the orders module. COD checkout
requires delivery, normalizes it and includes it in the idempotency fingerprint; changed
delivery rejects reuse of the key. Delivery writes roll back with failed stock reservations.
This changes the internal service contract; pre-0004 fingerprints cannot replay as new
delivery-bearing requests. No production orders exist or have been migrated. The down
migration refuses populated delivery storage. Protected access, retention rules, a production
adapter and approved PKR prices/stock/shipping/tax remain prerequisites for public checkout.

`migrations/0001_orders.up.sql` creates the private `commerce` schema, a migration-version
record, orders and immutable order-item snapshots. It has only been applied to disposable
local test databases. The running API still uses JSON and exposes no order endpoints.

The catalogue stays in `src/modules/catalogue/data/products.json`. Order items store a
slug, name, quantity and price snapshot, not a second mutable product catalogue. There is
no product foreign key until the catalogue is deliberately migrated.

## Verified rules

- PKR money uses integer minor units bounded by JavaScript's safe integer range.
- Line totals are generated by PostgreSQL; quantities currently match the cart's 1–99 limit.
- Totals satisfy subtotal minus discount plus shipping plus tax.
- Deferred constraint triggers require nonempty lines matching the subtotal at commit.
  Insert the order and its lines within one transaction.
- A unique idempotency key prevents duplicate orders. The request hash is reserved for
  later service-level detection of incompatible retries; replay behavior is not built.
- Financial and item snapshots cannot be changed. Retention/purge procedures will need
  a separately reviewed migration; ordinary deletion is not a cleanup mechanism.
- The schema is private, with RLS and no public policies. Backend roles and grants are
  not provisioned yet. Do not expose these tables through a public/anonymous client.

## Test locally

From `Backend/`:

```powershell
npm test -- src/modules/orders/schema.test.js
```

The tests use development-only PGlite, a PostgreSQL engine, with synthetic data in memory.
They never load `.env`, read `DATABASE_URL` or contact Supabase. They check atomic commit,
failed transaction rollback, constraints, immutable snapshots, RLS and migration reversal.
The test database is discarded when the process exits; this is not production storage.

PGlite uses a single connection. These tests do not prove behavior across concurrent
PostgreSQL clients, production roles, network failures or restart durability. Run those
checks against an isolated full PostgreSQL environment before enabling checkout.

## Migration and rollback boundaries

Both SQL files wrap their changes in a transaction. Apply the up migration once to a new
schema using a migration-owner connection. Existing schemas cause an error rather than
silently skipping mismatches. A production migration runner, checksum handling, application
roles and deployment procedure are still required before any live application.

The down migration takes exclusive table locks and refuses to run if orders exist. It is
intended for an empty schema; populated systems need forward fixes or a reviewed recovery
procedure. Tests demonstrate down/up reversal on an empty disposable database.

## Next work

Connect a production database adapter and server quote calculation to the internal
checkout service. Customer/delivery data, authenticated operator
access, valid order transitions, order event history and idempotent replay are not implemented.
The order status column only limits possible values; it does not enforce a state machine.

## Payment attempts (migration 0002)

Apply `0002_payment_attempts.up.sql` after `0001_orders`. It adds online payment attempts
and append-only status history. A composite foreign key binds every attempt to an online
order's exact PKR amount. COD collection will use a separate protected operator workflow.

Only one created, pending, unknown or succeeded attempt can exist per order. A confirmed
failure or cancellation permits a new attempt with a fresh idempotency key. An uncertain
gateway timeout belongs in `unknown`; never label it failed merely to allow a retry.
Provider references are unique per provider and cannot be replaced once set.

Attempts start as `created`. Created/pending/unknown attempts can advance to pending,
unknown or a final succeeded/failed/cancelled outcome, but cannot return to created.
Final outcomes cannot change. Refunds and reconciliation of contradictory provider events
need separate workflows; they must not rewrite the original charge history. Repeating the
same status creates no extra event. Attempts and events cannot be deleted by ordinary DML.

The trigger records status history atomically, but does not authenticate gateway messages,
deduplicate webhooks, update order status or call any provider. Backend permissions and
event ingestion remain unimplemented. Payment tables use RLS with no public policies.

Run `npm test -- src/modules/payments/schema.test.js` for local checks of amount binding,
retry restrictions, immutable references, transaction rollback, access denial and migration
reversal. The down migration refuses populated payment storage and preserves existing
orders when payment storage is empty. Reverse migrations in descending version order.
These tests use one disposable PGlite connection; full PostgreSQL concurrency and provider
integration tests remain required before checkout.

## Stock reservations (migration 0003)

Apply `0003_stock_reservations.up.sql` after the previous migrations. It adds stock
counters, reservations tied to exact order-line quantities and immutable status history.
It creates no stock records or approved availability. The canonical catalogue remains JSON.

An active reservation atomically increments reserved stock only when on-hand minus
reserved stock covers the quantity. A release decreases reserved stock; consumption
decreases both on-hand and reserved stock. Repeating a final status has no stock effect.
Final reservations cannot be reopened; a new purchase requires a new order line.
Ignored duplicate inserts do not change stock. An invalid or incomplete multi-line
reservation must roll back the whole checkout transaction.

Reservation expiry must be supplied explicitly and cannot be changed. Expired stock
remains held until explicitly released, and an expired reservation cannot be consumed.
The expiry worker, its approved time limit, and payment-versus-expiry orchestration are
not implemented. Checkout must coordinate cancellation, payment and fulfilment transitions;
these triggers do not authorize dispatch or determine that an order was paid.

Use `npm test -- src/modules/inventory/schema.test.js` for local checks. Stock rows use
conditional PostgreSQL updates rather than a separate availability read. PGlite tests
use a single connection: true concurrent PostgreSQL clients, lock ordering, deadlock retries
and simultaneous payment/expiry handling still need verification. Reserve multiple products
in a consistent product-slug order within one transaction when implementing checkout.

Inventory tables have RLS and no public policies. Runtime role grants and protected stock
adjustment workflows are still required; only migration/test owners can access them today.
The reservation history is not yet a complete stock-adjustment ledger. The down migration
refuses to remove any populated stock or reservation tables. No live database is connected.

## Internal COD transaction service

`src/modules/checkout/index.js` exports `createCodCheckout(db)`. It requires a database
adapter with `transaction(callback)` and transaction-scoped `query(sql, parameters)`;
the adapter must commit only after callback success and roll back on any error. PGlite
exercises this contract locally. A production connection adapter is not configured.

The service accepts an idempotency UUID, an explicit reservation expiry, and a trusted
server quote: PKR lines with slug/name/quantity/unit price plus discount/shipping/tax minor
units. It derives the total with integer arithmetic, hashes the normalized quote, and
sorts lines by slug for consistent inventory lock ordering. Orders and inventory are
written through their module interfaces in the same transaction. COD orders begin on hold.

An identical retry returns the existing order ID without changing stock or expiry. A
different quote with the same key is rejected. A failed transaction leaves the key reusable.
Replaying an old order does not assert it is still active; future handlers must read its
current state before displaying a checkout outcome.

This is not an HTTP contract. Never pass browser prices, tax or shipping into this service.
The server quote producer, customer/delivery validation, ownership/access checks and order
lookup are still missing. Include verified customer/delivery intent in the idempotency
fingerprint before accepting those details. No customer data is collected by this change.
Run `npm test -- src/modules/checkout/service.test.js` for transaction/retry checks.
