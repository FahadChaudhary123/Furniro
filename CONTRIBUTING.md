# Contributing

Thanks for working on Furniro. This covers how to get set up, the conventions the code
follows, and what a reviewable change looks like.

New here? [README.md](README.md) has setup and current status;
[ARCHITECTURE.md](ARCHITECTURE.md) explains why things are shaped the way they are.

---

## Setup

**Node `^20.19.0` or `>=22.12.0`** — Vite 8 refuses to start below that. Verified on Node
22.18.0 with npm 11.10.0.

Two shells — the front end fetches products from the API:

```bash
cd Backend  && npm install && npm run dev    # API on :3000
cd Frontend && npm install && npm run dev    # storefront on :5173
```

The two npm roots are independent — there is no workspace tool, so `Frontend/` and
`Backend/` each need their own `npm install`.

The back end runs:

```bash
cd Backend && npm install && npm run dev
```

Verify it with `npm run smoke` in another shell — 17 checks against the running server.
Structure and boundary rules: [docs/MODULES.md](docs/MODULES.md).

### Before you commit

`Backend/.env` holds live credentials. Ignore rules are in place, but verify before staging
— committing it once means rotating, and rotation is already outstanding:

```bash
git check-ignore -v Backend/.env    # must print the matching rule
git status                          # .env must not appear
```

Read [SECURITY.md](SECURITY.md#-current-exposure--act-on-this-first) for what to do if it
turns out `.env` is already in the history.

---

## Branching

`main` is the default branch and should always build. Work happens on a branch off it.

```
feat/product-detail-page
fix/shop-image-404
docs/api-contract
chore/drop-mongoose
refactor/cart-context
test/product-grid-pagination
```

Type prefix, then a short hyphenated description. One concern per branch — a branch that
fixes images *and* adds a cart is two reviews wearing a trenchcoat.

---

## Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body — why, not what>

<footer — refs, breaking changes>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
Scope is optional: `frontend`, `backend`, `shop`, `navbar`, `deps`.

Subject in the imperative — "add", not "added" — no trailing full stop, under 72
characters.

```
fix(shop): resolve product images through the bundler

The 32 catalogue rows referenced /images/productN.png, which resolves
against Frontend/public/ — a directory holding only vite.svg. Every image
on the shop page 404'd.

Import from src/assets/Products/ instead so Vite hashes and emits them.
```

The body earns its place by explaining *why*. The diff already shows what changed; it
cannot show what you knew when you changed it.

### AI-assisted commits

If an agent wrote a meaningful part of the change, add a trailer:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

You are the author and remain responsible for the change regardless — review it as if you
had typed it. See [CLAUDE.md](CLAUDE.md).

---

## Pull requests

**Before opening:**

- [ ] `npm run verify` passes in `Frontend/` (lint + build + performance budgets)
- [ ] Clicked through every route your change touches — `/`, `/shop`, `/about`, `/contact`
- [ ] Checked mobile width; the navbar has a drawer that is easy to break
- [ ] No secrets, no `.env`, no `console.log` left behind
- [ ] Docs updated if behaviour, API or schema changed
- [ ] `CHANGELOG.md` updated under *Unreleased*

**In the description:** what changed and why, how to verify it, before/after screenshots
for anything visual, and linked issues.

Keep them small. A 200-line PR gets a real review; a 2,000-line PR gets a rubber stamp.

At least one approving review before merge. Squash on merge so `main` reads as one commit
per change.

---

## Code conventions

Follow the surrounding code. Where it is inconsistent, prefer what is written here.

### Where files go

```
components/   Reused across pages — Navbar, Footer, ProductCard
sections/     One full-width band of a page — Hero, BrowseRange, BlogSection
pages/        One per route; composes sections, holds no logic
assets/       Images imported by the bundler
```

Dependencies point one way: `pages` → `sections` → `components`. A section never imports a
page.

### Naming

Components are `PascalCase`, and so are their files: `ProductCard.jsx`. Some existing page
files are lowercase (`shop.jsx`, `about.jsx`) and export lowercase function names — that
is inconsistent with the rest of the codebase and worth fixing opportunistically, in its
own commit.

Hooks are `useThing`. Utilities and variables are `camelCase`; module-level constants are
`SCREAMING_SNAKE_CASE`, as `PRODUCTS_PER_PAGE` already is.

### Components

Function components with hooks. No classes.

Hoist static data to module scope. `blogPosts` in `BlogSection.jsx` is declared inside the
component body and reallocated every render — do not copy that pattern.

Keep components under ~150 lines. `ProductGrid.jsx` is 324 because a 32-item array is
inlined above the component; that array belongs in `src/data/`.

Every item in a `.map()` needs a stable `key`. Not the array index — reorder or filter the
list and React reuses the wrong DOM node.

### Styling

Tailwind utilities in JSX. Plain CSS in `index.css` only for what Tailwind 3 cannot
express — the marquee keyframes are the existing precedent.

The brand gold is `#B88E2F`. It is currently written as an arbitrary value at each call
site; if you find yourself adding a fifth, lift it to `theme.extend.colors` first.

Mobile-first: unprefixed utilities are the small-screen case, `sm:` / `md:` / `lg:` layer
on top.

### Imports

Order them: external packages, then internal modules, then assets, then styles.

Relative paths only — there is no path alias configured. Note `App.jsx` imports
`../src/components/Navbar` from inside `src/`; that works but is a detour. Write
`./components/Navbar`.

### Images

Anything added to `src/assets/` must go through `npm run optimise:images` before it is
committed. The budget gate will fail the build otherwise, and it is meant to — the source
images here were once camera originals up to 6000x6000, shipped verbatim.

Originals are preserved in `.image-originals/` (gitignored) and the script always re-encodes
from those, so running it twice does not degrade anything.

Use JPEG for photographs. `hero-bg` was a 1.27 MB PNG of a photograph with no transparency;
as JPEG it is 69 kB. PNG is for images that need an alpha channel or sharp flat edges.

### Money

**Never store a formatted price string, and never use a float.** Integers in minor units,
formatted at the render boundary by one shared helper. This is the single most common
source of quiet correctness bugs in a storefront —
[DATA_MODEL.md](DATA_MODEL.md#money) has the reasoning and the helper.

---

## Dependencies

Adding one is a decision with an ongoing cost: install time, bundle size, a lockfile entry,
and a vulnerability surface you now own. Ask whether ~20 lines would do instead.

There is precedent for getting this wrong here, and for fixing it. Four dependencies have
been removed after measurement: `gsap` (one component nothing imported), `mongoose` (a
MongoDB driver in a Postgres project), `react-icons` (83 MB for three icons in one file)
and `framer-motion` (38.5 kB gzipped, 31% of the bundle, for one fade). See
[ARCHITECTURE.md](ARCHITECTURE.md#animation).

If you do add one: justify it in the PR description, check the maintenance status and
transitive weight, and prefer the smaller option.

`helmet` and `express-rate-limit` are the standing exception to "would twenty lines do".
Both are security-critical and easy to get subtly wrong — a hand-rolled limiter leaks memory
or mishandles IPv6, and a hand-rolled header set drifts as browser guidance changes.

### The Vite 8 beta

`Frontend` runs `vite@8.0.0-beta.13`, pinned through an `overrides` block that forces the
version onto transitive dependents too. Betas ship breaking changes between releases.

Do not bump it casually. When you do: read the changelog, run `npm run build` and
`npm run dev`, click through all four routes, and do it in its own commit so it can be
reverted alone.

### Browser data

If a build prints `browsers data (caniuse-lite) is N months old`, run:

```bash
cd Frontend && npx update-browserslist-db@latest
```

The warning is emitted once at process startup, so **restart any running dev server
afterwards** — an already-running process keeps the stale data for its whole lifetime and
will keep printing the warning.

---

## Testing

**End-to-end, with Playwright.** `npm run e2e` in `Frontend/` — currently 385 checks across
a desktop and a Pixel 5 viewport, run against the production build. The config starts both
servers itself, so it is the whole command.

Three of those specs are checkers rather than feature tests: `seo.spec.js` asserts the head
tags a crawler receives, `links.spec.js` crawls the site and follows every internal link, and
`accessibility.spec.js` runs `axe-core` over the purchase path at both viewports. All three
must run in a browser — the links, the head and the rendered colours only exist after React
runs, and the mobile menu button is `md:hidden`, so a desktop-only scan cannot see it.

When an accessibility check fails, fix the markup. The brand-gold contrast exception in
`accessibility.spec.js` is capped on purpose: raising the cap is not a fix, it is the signal
that the colour decision can no longer be deferred. See
[ADR 0011](docs/decisions/0011-automated-accessibility-checks.md).

**API-level, with the smoke suite.** `npm run smoke` in `Backend/` — 84 checks against a
running server: health, correlation ids, error shape, CORS, and the full catalogue and
content contracts.

```bash
cd Frontend
npm run e2e          # headless
npm run e2e:ui       # interactive, for writing tests
npm run e2e:report   # last HTML report
```

The suite starts both servers itself, so **CI jobs that run it need both packages
installed** — `Frontend/` and `Backend/`. That is not obvious from the job name and has
already broken CI once.

CI retries a failed test once. A test that passes on retry is reported as **flaky**, not
passed: that is a defect in the test or the code beneath it, and the retry exists to stop it
blocking a merge, not to excuse leaving it.

Add a case whenever you fix a user-visible defect. Every assertion in `e2e/` exists because
something was actually broken or a claim was made about a fix — that is what keeps the
suite from becoming decoration.

The suite earned its place immediately: it found a React error #31 that blanked `/shop`
entirely, while lint, build, performance budgets and all 46 API smoke checks were green.
**A build that succeeds is not a page that renders.**

Known gaps are recorded as `test.fail()` cases, so the suite documents them and tells you
when one closes rather than sitting quietly red.

**Unit tests, with Vitest.** `npm test` in either package — 56 checks in `Frontend/`, 62 in
`Backend/`, all in under a second.

```bash
cd Frontend && npm test        # money, badges, cart reducers
cd Backend  && npm test        # catalogue and content services, publish gate
```

They cover pure logic at its boundaries: rounding, quantity clamping, pagination arithmetic,
the last page, an empty result set. Reach for a unit test when the question is "is this
number right"; reach for the end-to-end suite when it is "does this work in a browser".

Writing them found two defects the browser suite could not see — `toMinorUnits` losing a
unit at a floating-point half-boundary, and a non-breaking space in formatted prices that
Playwright's whitespace normalisation had been hiding.

**Data and structure checks.** Three more gates run in CI and are worth running locally:

```bash
cd Backend  && npm run completeness   # catalogue data quality (CAT-04)
cd Frontend && npm run seo            # duplicate titles, orphaned pages (CONT-04)

# Needs a server whose rate limit is above the run size, or it throttles itself:
#   PORT=3101 RATE_LIMIT_MAX=3000 npm start
BASE_URL=http://localhost:3101 npm run latency   # API latency (NFR-04)
```

Each fails the build on an error and reports warnings without failing. When one of them
flags something, fix the data or the route — never relax the rule to get a green build.

---

## Documentation

Update docs in the same PR as the change, not afterwards.

| Change | Update |
|---|---|
| Setup, scripts, project status | [README.md](README.md) |
| Structure, or a decision with a trade-off | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Any endpoint | [API.md](API.md) |
| Any entity shape or schema | [DATA_MODEL.md](DATA_MODEL.md) |
| Anything user-visible | [CHANGELOG.md](CHANGELOG.md) |
| Deploy or operational procedure | [docs/runbooks/](docs/runbooks/) |
| A choice a reasonable engineer could have made differently | [docs/decisions/](docs/decisions/) |

**Record a decision with the change that makes it, not afterwards.** The existing records
were written retrospectively and it shows: the measurements survived in the changelog, but
the alternatives that were weighed and dropped had to be reconstructed. Those are the part a
future reader actually wants.

A doc that describes something that is not true is worse than no doc. If you find one, fix
it — that is a welcome PR on its own.

---

## Good first issues

Small, self-contained, and each fixes something real:

*Reviewed 2026-09-09. Everything previously listed here had been fixed — broken shop images,
`Rs` instead of `Rp`, the missing `*` route. A stale list of "good first issues" wastes the
time of exactly the person it is meant to help, so they were removed rather than left.*

1. **Rename the lowercase page files** — `shop.jsx`, `about.jsx` and `contact.jsx`, whose
   components are already PascalCase.
2. **Give `/blog` its own route.** The blog currently lives at `/about`: the nav says
   "About", the URL says `/about`, and the heading, breadcrumb and title all say "Blog".
   `npm run seo` reports it as two warnings. Needs a decision on whether About content
   should exist too — ask before starting.
