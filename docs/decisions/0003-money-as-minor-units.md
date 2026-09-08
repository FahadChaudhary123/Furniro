# 0003 — Money as integer minor units

**Date** 2026-09-07 · **Status** Accepted

## Context

Prices existed in two forms across two components: `2500000` as a number, and
`"Rp 2.500.000"` as a formatted string. Neither could be sorted, filtered or summed
reliably, and the shop's "Price: low to high" control could not have worked.

## Decision

Prices are integers in minor units everywhere — data, API and client. Formatting happens at
the render boundary through one helper, `shared/lib/money.js`.

## Alternatives

**Floats.** Disqualified outright: `0.1 + 0.2 !== 0.3`, and money that does not add up is a
defect a customer notices on an invoice.

**Formatted strings, parsed when needed.** Rejected — it moves the problem to every call site
and makes locale a data concern rather than a display one.

**A decimal library.** Rejected as premature. Integers are exact for the arithmetic actually
performed; a library becomes worth its weight when tax, multi-currency or proportional
discounts arrive.

## Consequences

- Every price is `× 100` in the data. `toMinorUnits()` makes the conversion visible at
  authoring time rather than a trailing `00` nobody questions.
- The API contract inherits it: `price: 250000000`, never `"Rp 2.500.000"`.
- One place to change when the currency question is settled — the storefront still renders
  `Rp` while a stray `Rs` existed in the same card, so it is not settled yet.
