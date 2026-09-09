# Architecture

Why the system is shaped the way it is, and where the seams are. For what exists today
versus what is planned, see [README.md](README.md#current-state).

Individual decisions — with the alternatives that were rejected and what each one costs —
are recorded in [docs/decisions/](docs/decisions/). This document describes the resulting
shape; those explain how it was arrived at.

---

## Shape

Two independently deployable units in one repository:

```
Browser
  │
  │  static assets (HTML, JS, CSS, images)
  ▼
Frontend/  ── React 19 SPA, built by Vite 8, served as static files
  │
  │  HTTPS/JSON   ← catalogue only; cart, orders, auth still to come
  ▼
Backend/   ── Express 5 API
  │
  │  @supabase/supabase-js
  ▼
Supabase   ── managed Postgres + Auth + Storage
```

That hop now carries the catalogue: the shop grid and the home-page strip fetch from
`GET /api/products`. Everything else on the page — hero, range categories, rooms, blog —
still renders from arrays inside its own component.

### Why a separate back end at all

The front end could talk to Supabase directly from the browser — that is what the anon key
is for, with row-level security as the guard. An Express tier is still worth its keep here
because the roadmap includes orders and payments:

- Payment provider secret keys can never reach the browser, so a server is required the
  moment checkout is real.
- Order totals must be recomputed server-side. A price posted from the client is an
  attacker-controlled number.
- Webhooks from a payment provider need a public HTTP endpoint to land on.

Until any of that exists, the Express tier is optional. Adding it now costs a deployment
target and a hop of latency; the payoff is that checkout does not force a re-architecture
later. That is the trade this repo has chosen.

---

## Front end

**Stack:** React 19, React Router 7, Vite 8 (beta), Tailwind CSS 3, `lucide-react` for
iconography. No animation library — see [Animation](#animation).

`react-icons` was also removed: it was 83 MB installed and used in one file for three
icons, while `lucide-react` served the other seven files. Same duplication as the animation
libraries, same resolution — pick one.

### Composition model

Three tiers, by directory, with a strict dependency direction:

```
pages/  ──imports──▶  sections/  ──imports──▶  components/
```

- **`pages/`** — one file per route. Each is a thin list of sections in order, holding no
  logic of its own. [Shop.jsx](Frontend/src/pages/Shop.jsx) is representative: four
  children, no state.
- **`sections/`** — a full-width band of the page (Hero, BrowseRange, BlogSection). Owns
  its own content array and its own local state.
- **`components/`** — reused across pages (Navbar, Footer, ProductCard).

Nothing imports upward. A section never imports a page.

### State

There is no global state — no Context, no Redux, no React Query. All state is `useState`
local to one component, and there are exactly two pieces of it:

| State | Owner | Purpose |
|---|---|---|
| `isOpen` | [Navbar.jsx](Frontend/src/components/Navbar.jsx) | Mobile drawer open/closed |
| `currentPage` | [ProductGrid.jsx](Frontend/src/components/ProductGrid.jsx) | Shop pagination |

Server data now arrives through `useProducts()` / `useFeaturedProducts()` in
`modules/catalogue`, each owning its own loading and error state. That is deliberate: a
server-state library earns its place once there is caching, revalidation and mutation to
coordinate, and there is none of that yet.

**The cart was the trigger for shared state, as predicted.** It is read by the navbar badge
and written by every product card — cousins in the tree with no common owner but the root.
`CartProvider` sits above the router in `main.jsx` with a `useCart()` hook, rather than a
state library: one store, no server mutations to coordinate, no cache to invalidate.

Server data stayed out of it. The cart stores `{slug, quantity}` only and re-reads prices
from the API, so a repricing is reflected immediately and no stale price can be displayed.

### Routing

[main.jsx](Frontend/src/main.jsx) mounts `BrowserRouter`; [App.jsx](Frontend/src/App.jsx)
renders `Navbar` outside `Routes` so it persists across navigation, then declares four
routes.

Two structural notes:

- **`Footer` is not in `App.jsx`.** Every page imports and renders its own. That is four
  copies of one decision — moving `Footer` up beside `Navbar` removes the duplication and
  guarantees consistency, at the cost of pages no longer controlling their own trailer.
- **A `*` catch-all is in place**, rendering `NotFound`. Each route sets its own document
  head — title, meta description, canonical and robots — through `shared/lib/usePageMeta`,
  driven by the route manifest in `shared/lib/routes.js`.

`BrowserRouter` uses the History API, so **any static host must rewrite unknown paths to
`index.html`** or a hard refresh on `/shop` returns a 404 from the host. See
[docs/runbooks/deployment.md](docs/runbooks/deployment.md).

### Styling

Tailwind utilities in JSX, configured over `./index.html` and `./src/**/*.{js,jsx}` in
[tailwind.config.js](Frontend/tailwind.config.js). `theme.extend` is empty, so the brand
gold `#B88E2F` appears as an arbitrary value (`text-[#B88E2F]`) at each call site. Lifting
it to `theme.extend.colors.brand` would make it a single point of change.

Keyframe animations that Tailwind 3 cannot express — the two marquee loops — live as plain
CSS in [index.css](Frontend/src/index.css).

### Animation

**Neither animation library remains.** Two were installed for one effect.

- **GSAP** — imported only by an `AnimationDemo` component that nothing imported. Tree-shaken
  out of the bundle, so it cost nothing to ship and 6.4 MB to install. Both removed.
- **Framer Motion** — used in exactly one place, a fade-and-rise wrapping the whole home
  page. Measured at **38.5 kB gzipped, 31% of the JS bundle**, for that single effect. Since
  the wrapper spanned the page from the top it was in view immediately, so `whileInView` was
  really a load animation. Replaced by an `animate-reveal-up` keyframe in `index.css`, which
  is visually identical, costs nothing, and additionally honours
  `prefers-reduced-motion` — which the Framer configuration did not.

This is a measured decision, not a principle. If real animation work arrives — timeline
sequencing, gesture-driven motion, shared-element transitions — Framer Motion is one
`npm install` away and remains the better fit for React's declarative model. A 38.5 kB
dependency for one fade was simply poor value on a storefront where weight is a CI gate.

### Build

A `RouteErrorBoundary` wraps the route tree inside the shell, so a chunk that fails to load
keeps the navbar and offers a reload instead of unmounting everything to a blank page. Two
behaviours are worth knowing and are pinned by tests: the Suspense fallback renders only on
a **direct** load of a lazy route, because React Router navigates inside a transition and
React retains the previous UI rather than flashing a fallback; and a failed chunk is a
**post-deploy** failure mode, not a hypothetical one.

Routes are code-split with `React.lazy`, except `HomePage` — lazy-loading the page a
visitor has just landed on costs a round trip before anything renders, which optimises the
wrong thing. Each other route is its own chunk, so someone reading the blog no longer
downloads the cart and the shop grid.

Vite 8 with `@vitejs/plugin-react`. `vite.config.js` is at defaults — no path aliases, so
imports are relative, which is why `App.jsx` reaches for `../src/components/Navbar` from
inside `src/`. An `@` to `src` alias would flatten that.

Vite 8 is a **beta**, pinned through an `overrides` block in `package.json` that forces the
version onto transitive dependents too. Betas move fast and can break between releases;
[CONTRIBUTING.md](CONTRIBUTING.md) covers the upgrade discipline this implies.

Images under `src/assets/` are imported as modules, so they are hashed, and inlined or
emitted by the bundler. Files in `public/` are copied verbatim and must be referenced by
absolute path. The broken shop images are exactly this distinction going wrong — they use
`public/`-style paths for files that were never placed in `public/`.

---

## Back end

**Intended stack:** Express 5, `@supabase/supabase-js`, `cors`, `dotenv`.

> **Superseded for the target state.** [docs/MODULES.md](docs/MODULES.md) replaces this
> group-by-technical-role layout with a group-by-domain one: 20 modules, each owning its
> tables and exposing a single `index.js`. The layering below still describes what exists
> in the repository today.

**That skeleton is gone.** `config/`, `controllers/`, `models/`, `routes/`, `middlewares/`
and `utils/` declared a conventional layered Express app and then stayed **empty** while the
real code was written in `src/`. Five directories describing a structure nothing used were
removed on 2026-09-09; an empty directory that a document calls the architecture is worse
than no directory, because it is where the next person looks first.

What replaced them, per file rather than per layer:

```
src/app.js                    Composition root; middleware order and route mounting
src/platform/                 Config, logging, correlation ids, errors, health
src/modules/<name>/
  routes.js                   URL to controller binding
  controller.js               HTTP concerns: validate, call service, shape response
  service.js                  Business rules; no req, no res, no status codes
  repository.js               The ONLY file that touches a data store
  index.js                    The module's entire public surface
```

The rule that makes the layering worth having is unchanged, only relocated: **nothing above
`repository.js` touches the data store.** That is what keeps the data layer swappable and
the services testable without a server.

**Built.** `Backend/src/platform/` implements the Layer 0 module — config, logging,
correlation ids, error handling, health — and `src/app.js` is the composition root domain
modules mount into. The old `config/supabase.js` is gone; its two defects (ESM syntax in a
package not declared as ESM, and a client constructed before dotenv had run) are fixed by
construction. See [README.md](README.md#back-end-structure) and
[docs/MODULES.md](docs/MODULES.md).

### Three data layers, resolved to one

The back end once declared three ways to reach a database. Two of them reached nothing.

| Package | Talks to | Outcome |
|---|---|---|
| `@supabase/supabase-js` | Supabase Postgres, over HTTP | **Kept.** In use at `src/platform/supabase.js`; brings Auth, Storage and row-level security |
| `pg` | Postgres, over the wire protocol | **Removed 2026-09-09.** Declared as a dependency, imported by nothing — 604 kB of `node_modules` and a standing question rather than a decision |
| `mongoose` | MongoDB | **Removed earlier.** Cannot connect to Postgres at all; it was in the tree by accident |

Removing `pg` does not foreclose raw SQL. `npm install pg` restores it in one command, and
`repository.js` is the only file that would change — that is the point of confining data
access to it. What it does remove is a dependency nobody could justify and a "decision"
nobody was going to make.

Every unused dependency is install time, lockfile churn and vulnerability surface for
nothing. Four have now been removed for exactly that: `gsap`, `mongoose`, `react-icons`,
`framer-motion` — and `pg` makes five.

### Error handling

Express 5 changed one thing that matters here: a rejected promise in an `async` handler is
now forwarded to the error middleware automatically, so the `try/catch`-and-`next(err)`
wrapper that Express 4 required is obsolete. Register one error middleware last, with the
four-argument signature `(err, req, res, next)`, and let handlers throw.

---

## Data

Today: JavaScript arrays inside component files. Six independent literals across five
files, two of them describing products in mutually incompatible shapes. See
[DATA_MODEL.md](DATA_MODEL.md).

Planned: Supabase Postgres. The migration path is to keep the array shape as the API
response shape wherever it is already sensible, so components change at the fetch boundary
only — one `useProducts()` hook replacing one `import`.

---

## Cross-cutting decisions

| Decision | Chosen | Why | Cost |
|---|---|---|---|
| Repo layout | Monorepo, two npm roots, no workspace tool | Two `package.json` files with no shared code; a workspace tool would add config for no gain | Dependencies installed twice; no shared lint config |
| Rendering | Client-side SPA | Simplest to build and host | Weak SEO and slow first paint — both matter for a storefront, and both point at SSR later |
| Language | JavaScript, not TypeScript | Lower ceremony | `@types/react` is installed but inert; the product shape is enforced by nothing |
| Styling | Tailwind utilities | Fast, no naming overhead | Long `className` strings; no design tokens while `theme.extend` is empty |
| Auth | None yet | Not needed for a catalogue | Supabase Auth is the natural choice — it is already a dependency |

---

## Known architectural debt

Ordered by how expensive each becomes if deferred:

1. **No shared state container.** Blocks the cart entirely, and the cart is the next
   feature. Highest cost to defer.
2. **Product data duplicated in two shapes.** Guarantees the API integration is done twice,
   inconsistently. Reconcile before writing any fetch code.
3. **Back end is three unpicked stacks and an empty entry point.** Every day it stays that
   way, the front end grows more assumptions about data it invents locally.
4. **No tests and no CI.** Nothing prevents a regression from reaching a deployment.
5. **Footer duplicated across four pages** and **no 404 route.** Both cheap now, both
   permanent irritants later.
