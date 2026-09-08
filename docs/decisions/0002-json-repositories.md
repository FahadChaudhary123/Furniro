# 0002 — JSON repositories until a database exists

**Date** 2026-09-07 · **Status** Accepted

## Context

The catalogue and content modules needed a data source. No schema existed, and creating
tables in a live Supabase project holding unrotated credentials was not something to do as a
side effect of building an endpoint.

## Decision

Each module's `repository.js` reads a JSON file and is **the only file in that module that
touches a data store**. Everything above it — service, controller, routes — is written as
though a database were already there.

## Alternatives

**Create the Supabase schema first.** Rejected as not mine to do unprompted: it is a change
to someone's live project, and the credentials for it were overdue for rotation.

**An in-memory store seeded at boot.** Rejected — it loses the file as a reviewable artefact,
and product data being reviewable in a diff is worth something.

**Wait for the database before building the API.** Rejected: the contract, validation,
pagination and error handling are the same work either way, and doing them first means the
schema arrives to a known shape rather than inventing one.

## Consequences

- Swapping one file per module is the whole migration. The seed is a script, not a rewrite,
  because `products.json` already matches the proposed table.
- No writes, no transactions, no concurrency. Nothing above the repository assumes otherwise.
- `GET /health/ready` reports Supabase as *configured* rather than *reachable*, because
  nothing has ever opened a connection. That check becomes real with the schema.
