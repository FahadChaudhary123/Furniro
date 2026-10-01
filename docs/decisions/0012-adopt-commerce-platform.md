# 0012 — Adopt a commerce platform

**Date:** 2026-10-01  
**Status:** Accepted

## Context

The running application has a catalogue API, content API and guest cart, but no durable
orders, checkout, payments, inventory or accounts. The derived requirements cover all of
those capabilities. Building each domain here would delay the first trading release.

## Decision

Adopt a commerce platform for the trading system. Keep Furniro's existing storefront and
read APIs while defining the integration boundary. The platform will own checkout,
payments, orders and inventory; its own authoritative price and availability must be used
when a buyer checks out. The browser cart's `{slug, quantity}` entries can be mapped to
platform variants after a product mapping exists. No local JSON price becomes an order
total.

Provider selection is a separate decision. Evaluate hosted checkout, product and variant
mapping, shipping/tax markets, payment methods, webhooks, order/admin workflows, API limits,
data portability, and total cost before choosing one. Do not add checkout buttons that imply
a functioning purchase flow until that integration is verified end to end.

## Alternatives

- Build all commerce modules in the existing API: maximum control, but a much larger
  delivery and operating burden.
- Adopt a platform: selected to get a real trading path sooner while retaining this
  storefront.

## Consequences

The proposed `checkout`, `payments`, `orders`, `inventory`, and related modules in
[MODULES.md](../MODULES.md) are capability boundaries, not approved local implementations.
The requirements remain open until platform behavior and Furniro's integration are tested.
Catalogue data must gain a deliberate product/variant mapping without creating a second
copy of the current product catalogue.
