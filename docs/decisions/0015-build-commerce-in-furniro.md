# 0015 — Build commerce in Furniro

**Date:** 2026-10-12  
**Status:** Accepted  
**Supersedes:** ADR 0012 and ADR 0014; revises the implementation ownership in ADR 0013.

## Context

The user explicitly chose Furniro alone after clarifying that there is no Shopify store.
The application currently has read APIs and a guest cart, but no durable commerce state.
The earlier Shopify selection and onboarding tools have not connected any store.

## Decision

Build checkout, pricing, orders, inventory and operator workflows in the existing Furniro
modular monolith. A Shopify account, product mapping or commerce platform is not required.
Furniro's server will calculate totals and persist orders in a transactional database.
Keep the current JSON catalogue as the only product source until a reviewed database
migration replaces it; do not introduce a second mutable catalogue.

Keep Pakistan-only PKR trading and both COD and online payment from ADR 0013. Implement
and test the COD path first, followed by online payment; this sequencing does not authorize
a COD-only public launch. Use a payment processor's hosted payment collection for online
payments so Furniro does not collect card details. Safepay remains an unverified candidate
for direct integration; previous Shopify compatibility evidence is not direct-API approval.

Begin with versioned database migrations and transaction boundaries for orders, order
items, payment attempts, idempotency and inventory reservations. Local test fixtures may
use synthetic prices and stock, clearly separate from approved production data. Do not
write orders to JSON or represent an in-memory test repository as durable storage.

## Alternatives

- Shopify or another commerce platform: superseded by the user's choice to own the store.
- Immediate public checkout over the current JSON API: lacks durable orders, concurrency
  control, approved PKR prices and verified fulfilment, so it cannot support trading.

## Consequences

Furniro now owns order state transitions, access controls, payment reconciliation, refunds,
stock concurrency, backups and operational support. A live database and payment account
are still needed before public checkout, but Shopify onboarding is removed from the plan.
Deployment remains deferred at the user's request. Existing provider comparison, mapping
scripts and onboarding notes are historical experiments, not prerequisites or runtime
dependencies. Requirement counts remain unchanged until working behavior is verified.
