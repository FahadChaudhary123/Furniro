# 0007 — The cart stores identifiers, never prices

**Date** 2026-09-08 · **Status** Accepted

## Context

The guest cart persists to `localStorage`, which is under the visitor's control and survives
indefinitely. It has to display prices and a subtotal.

## Decision

Storage holds `{ slug, quantity }` and nothing else. Line detail is re-read from
`GET /api/products?slugs=…` on every load. The subtotal is a display figure computed from
those server prices and is never submitted anywhere.

## Alternatives

**Store a snapshot of name, image and price.** Rejected: a cart holding its own price shows
yesterday's price after a repricing, and the customer sees one number and is charged
another. It is the same mistake as a client submitting an order total, one step earlier.

**Store the price and revalidate at checkout.** Rejected — it makes the wrong value the
default and the correct one an extra step that can be skipped.

**A server-side cart.** The right answer eventually (`CART-04`, `CART-05`), but it needs
identity and a data store, neither of which exists.

## Consequences

- Hydration is a network round trip, so the cart has a loading state. The badge count reads
  from storage rather than hydrated lines, so it is correct immediately.
- One batched request (`?slugs=`) rather than one per line — added to the API for this.
- A product that no longer exists drops out of the cart instead of sitting there unbuyable.
- Tampered storage is inert: a `price` field injected by hand is ignored, because nothing
  reads it. There is a test that does exactly this.
