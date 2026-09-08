# 0006 — Shop state lives in the URL

**Date** 2026-09-08 · **Status** Accepted

## Context

The shop kept category, search, sort, page and page size in `useState`. That made a filtered
view unshareable, broke the back button through filter changes, and meant the category link
on every product page — pointing at `/shop?category=living-room` — **silently did nothing**.

## Decision

All five live in the query string via `useSearchParams`, and each maps onto a parameter the
API already validates. Values equal to their default are omitted so the URL stays readable.

## Alternatives

**Keep local state and remove the dead link.** Rejected: it treats the symptom. Filtered
views being unshareable is the real loss on a storefront, where a category page is exactly
what somebody sends a friend.

**A client-side store synced to the URL.** Rejected as two sources of truth for one value,
and the sync is where the bugs live.

**Fetch everything and filter in the browser.** Rejected: it works at 40 products and stops
working at 400, and the API already does this correctly with a validated whitelist.

## Consequences

- The back button works, filtered views are bookmarkable, and anything can link into a
  filtered shop.
- The server, not the client, decides what a filter means. An unknown category returns 400
  rather than an empty grid, so a typo is visible rather than silent.
- State changes are navigations. Changing a filter must reset the page, or page 4 of a new
  filter is a blank grid.
