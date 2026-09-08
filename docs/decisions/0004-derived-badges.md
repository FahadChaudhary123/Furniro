# 0004 — Product badges derived, never stored

**Date** 2026-09-07 · **Status** Accepted

## Context

Products carried a `badge` field: `"-30%"`, `"New"`, or absent. A discount badge is a
function of two prices, and a "New" badge is a function of a date — storing either creates a
second source of truth for something already known.

## Decision

`badgeFor(product, now)` computes the badge from `price`, `old_price` and `created_at`. No
`badge` field exists in the data or the API response.

## Alternatives

**Keep the stored badge, add validation.** Rejected: a check that two fields agree is a
worse version of computing one from the other.

**Store the badge and recompute on write.** Reasonable with a database and a write path,
which is where this may end up for query performance. Not warranted at 40 products.

## Consequences

- Replacing the stored badges immediately surfaced **two that were wrong and live**:
  Syltherine was labelled `-30%` on a 2.5M/3.5M pair that is `-29%`, and a recliner was
  labelled `-10%` on a genuine `-13%`. Neither was findable by reading the code.
- "New" is now time-dependent, so a product ages out of the badge on its own. That is the
  intended semantic and it means the home page changes without anyone editing it.
- A merchandiser cannot hand-pick a badge. If that is ever wanted it is a new, explicit
  field — not a resurrection of this one.
