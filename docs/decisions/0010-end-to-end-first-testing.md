# 0010 — End-to-end tests as the primary safety net

**Date** 2026-09-08 · **Status** Accepted

## Context

The project had no tests. The first serious candidate for one was a bug: `/shop` rendered a
**completely blank page** — React error #31, an object passed where a string was expected —
while lint, build, performance budgets and all 46 API checks were green.

A build that succeeds is not a page that renders.

## Decision

Playwright against the production build, both servers started by the config, as the primary
safety net. API-level checks stay in a smoke suite; byte budgets stay in a script.

## Alternatives

**Unit tests first (Vitest).** Rejected as *first*, not as unnecessary — and they landed on
2026-09-08. No unit test would have caught the blank page: every unit was fine and the
composition was broken. But the reverse also holds, and writing them found two things the
browser suite could not: `toMinorUnits` losing a unit at floating-point half-boundaries, and
`formatPrice` separating the symbol with U+00A0 rather than a space, which Playwright's
whitespace normalisation had been hiding.

**Component tests (Testing Library).** Faster and closer to the code, but they render in a
simulated DOM. Several defects found here were only visible in a real browser: a mobile
layout where the quantity input covered the remove button, images with a `src` that never
decoded, WebP negotiation, `prefers-reduced-motion`.

**Trust the type system.** There isn't one — this is JavaScript.

## Consequences

- The suite is slow by unit-test standards (~90s) and is a merge gate rather than something
  run on every save.
- Written against roles and accessible names, so it doubles as accessibility pressure. It
  has already forced two real fixes: duplicate adjacent links to the same product, and the
  distinction between a missing `alt` and a deliberately empty one.
- The two layers answer different questions and both are needed. 91 unit tests run in under
  a second and cover arithmetic at its boundaries; 385 browser checks take 90 seconds and
  cover composition, layout and real network behaviour.
- It only tests what someone thought to assert. Running the suite after a change proves
  nothing broke; it says nothing about whether the new behaviour works. Coverage for
  code splitting, the CSS reveal and reduced motion was written **after** those shipped —
  and writing it found a failed chunk blanking the entire site.
