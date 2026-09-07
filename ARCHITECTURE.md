# Architecture

Why the system is shaped the way it is, and where the seams are. For what exists today
versus what is planned, see [README.md](README.md#current-state).

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
  │  HTTPS/JSON   ← does not exist yet
  ▼
Backend/   ── Express 5 API
  │
  │  @supabase/supabase-js
  ▼
Supabase   ── managed Postgres + Auth + Storage
```

That third hop is the whole of the unfinished work. The front end currently terminates at
itself: it imports arrays from its own source files and renders them.

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

**Stack:** React 19, React Router 7, Vite 8 (beta), Tailwind CSS 3, Framer Motion 12,
`lucide-react` and `react-icons` for iconography.

### Composition model

Three tiers, by directory, with a strict dependency direction:

```
pages/  ──imports──▶  sections/  ──imports──▶  components/
```

- **`pages/`** — one file per route. Each is a thin list of sections in order, holding no
  logic of its own. [shop.jsx](Frontend/src/pages/shop.jsx) is representative: four
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

This is correct for a catalogue that never changes. **It stops being correct at the cart** —
a cart is read by the navbar badge and written by every product card, which are cousins in
the tree with no common owner but the root. That is the trigger to introduce shared state,
and the recommendation is a `CartContext` at the `App.jsx` level plus a `useCart()` hook,
rather than a state library. Server data (products, once fetched) is a different problem
with different caching needs; keep it out of the cart store.

### Routing

[main.jsx](Frontend/src/main.jsx) mounts `BrowserRouter`; [App.jsx](Frontend/src/App.jsx)
renders `Navbar` outside `Routes` so it persists across navigation, then declares four
routes.

Two structural notes:

- **`Footer` is not in `App.jsx`.** Every page imports and renders its own. That is four
  copies of one decision — moving `Footer` up beside `Navbar` removes the duplication and
  guarantees consistency, at the cost of pages no longer controlling their own trailer.
- **There is no `*` catch-all route.** An unknown path renders the navbar and nothing else.
  A `NotFound` page is needed before any public deployment.

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

Two libraries are installed for one job:

- **Framer Motion** — used, in `HomePage.jsx`, for a scroll-triggered fade-and-rise.
- **GSAP** — imported only by
  [AnimationDemo.jsx](Frontend/src/components/AnimationDemo.jsx), which nothing imports. It
  is dead weight in the dependency tree and in the bundle budget.

Pick one. Framer Motion is the one in use and the better fit for React's declarative model;
GSAP earns its place only for timeline-heavy sequencing this project does not have.

### Build

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

The directory skeleton — `config/`, `controllers/`, `models/`, `routes/`, `middlewares/`,
`utils/` — declares a conventional layered Express app:

```
routes/       URL to controller binding, one router per resource
controllers/  HTTP concerns: parse request, call model, shape response
models/       Data access; the only layer that touches Supabase
middlewares/  Cross-cutting: CORS, auth, validation, error handling
utils/        Pure helpers, no I/O
config/       Client construction from environment
```

The rule that makes the layering worth having: **a controller never imports the Supabase
client directly.** It goes through `models/`. That is what keeps the data layer swappable
and the controllers testable.

Only `config/supabase.js` exists so far, and it has two problems documented in
[README.md](README.md#wiring-up-the-back-end): ESM syntax in a package not declared as ESM,
and no `dotenv.config()` call before the client is constructed.

### Three data layers, pick one

`@supabase/supabase-js`, `mongoose` and `pg` are all dependencies.

| Package | Talks to | Verdict |
|---|---|---|
| `@supabase/supabase-js` | Supabase Postgres, over HTTP | **Keep.** Matches the existing config, and brings Auth, Storage and row-level security. |
| `pg` | Postgres, over the wire protocol | Drop unless raw SQL is needed. Redundant with the above. |
| `mongoose` | MongoDB | **Drop.** Cannot connect to Postgres at all; it is in the tree by accident. |

Every unused dependency is install time, lockfile churn and vulnerability surface for
nothing.

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
