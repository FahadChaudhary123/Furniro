# 0005 — Slugs, not ids, in public URLs

**Date** 2026-09-07 · **Status** Accepted

## Context

Product and post pages needed addresses. Both entities carry an integer `id` and a
human-readable `slug`.

## Decision

Public URLs use the slug: `/shop/syltherine`, `/blog/featured-design-trends-for-2022`. The
API matches — `GET /api/products/:slug`.

## Alternatives

**Ids.** Rejected: `/shop/17` tells a person nothing, and ids are an implementation detail
that a reseed or a migration renumbers. Doc B §15 wants a 301 to the nearest live product
rather than a bare 404 on an indexed URL, which is far easier to reason about with names.

**Both, with the id canonical** (`/shop/17-syltherine`). Rejected as the worst of each: it
still leaks the id, and it invites two URLs for one page unless carefully redirected.

## Consequences

- Slugs must be unique and stable. Renaming a product is now a redirect problem, not a free
  edit — which is correct, because the old URL may be indexed or shared.
- The repository looks up by slug, so a database index belongs on that column, not only on
  the primary key.
- An unknown slug is a *missing product*, not a broken site. The product page distinguishes
  the two and offers a route back rather than an error panel.
