# 0001 — A modular monolith, not services

**Date** 2026-09-07 · **Status** Accepted

## Context

Document B describes an operation that at scale reads like separate services: per-surface
SLOs in §5, queues in §7 R6, per-store backup policies in §8. The requirement set decomposes
into 20 modules ([MODULES.md](../MODULES.md)). Furniro at the time had one engineer and an
empty `Backend/index.js`.

## Decision

One deployable per surface — a storefront API and, later, a back office — with hard module
boundaries inside. Each module owns its tables, exposes an explicit `index.js`, and never
reaches into another's internals.

## Alternatives

**Services from the start.** Rejected: ~20 deployables for one engineer means the entire
budget goes to orchestration before a single requirement ships. Doc B §3 wants every release
revertible in under ten minutes and §8 wants a monthly restore drill — both are harder, not
easier, split across services.

**A monolith with no internal boundaries.** Rejected because it is a one-way door. A tangled
monolith cannot be split at any price; a clean module lifts out when it earns its own
deployable.

## Consequences

- Extraction stays possible. `payments` is the likeliest first candidate — a PCI scope
  boundary and its own failure domain — and is still not urgent.
- The boundaries are only real if enforced. Rule 2 (import via `index.js` only) needs an
  ESLint `no-restricted-imports` rule, not discipline.
- One database, one transaction, one restore. That is the main payoff and it is easy to
  undervalue until an incident.
