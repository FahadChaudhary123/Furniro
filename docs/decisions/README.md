# Architecture decision records

Short, dated notes on decisions that were not obvious — context, what was decided, what was
rejected, and what it costs.

Required by Document B §18:

> **Architecture decisions are recorded** as short dated notes: context, decision,
> alternatives, consequences. Six months on, nobody remembers why — and the record prevents
> relitigating settled choices.

## What belongs here

A decision earns a record when **a reasonable engineer could have chosen otherwise**. If
there was no real alternative, it is not a decision, it is just how it is done — that belongs
in [ARCHITECTURE.md](../../ARCHITECTURE.md) or a code comment.

Not here: how something works (that is the code), what changed (that is
[CHANGELOG.md](../../CHANGELOG.md)), or what still needs doing (that is
[REQUIREMENTS.md](../REQUIREMENTS.md)).

## The record

| # | Decision | Date | Status |
|---|---|---|---|
| [0001](0001-modular-monolith.md) | A modular monolith, not services | 2026-09-07 | Accepted |
| [0002](0002-json-repositories.md) | JSON repositories until a database exists | 2026-09-07 | Accepted |
| [0003](0003-money-as-minor-units.md) | Money as integer minor units | 2026-09-07 | Accepted |
| [0004](0004-derived-badges.md) | Product badges derived, never stored | 2026-09-07 | Accepted |
| [0005](0005-slugs-not-ids.md) | Slugs, not ids, in public URLs | 2026-09-07 | Accepted |
| [0006](0006-shop-state-in-the-url.md) | Shop state lives in the URL | 2026-09-08 | Accepted |
| [0007](0007-cart-stores-no-prices.md) | The cart stores identifiers, never prices | 2026-09-08 | Accepted |
| [0008](0008-no-animation-library.md) | No animation library | 2026-09-08 | Accepted |
| [0009](0009-size-images-before-format.md) | Size images to their box before changing format | 2026-09-08 | Accepted |
| [0010](0010-end-to-end-first-testing.md) | End-to-end tests as the primary safety net | 2026-09-08 | Accepted |

## A caveat on these dates

**These were written retrospectively**, on 2026-09-08, from the code, the changelog and the
measurements taken at the time. Document B wants a decision recorded when it is made; this
set is catching up. Records from here on should be written with the change that makes them.

## Writing one

Copy the shape of any existing record. Keep it to a page. The **Alternatives** section is the
part that ages best — a future reader mostly wants to know what was already ruled out, and
why, so they do not spend a day rediscovering it.

Statuses: **Accepted**, **Superseded by NNNN**, **Deprecated**. Never delete a record; a
decision that was reversed is more useful than one that was erased.
