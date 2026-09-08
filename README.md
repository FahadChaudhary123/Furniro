# Furniro

A furniture e-commerce storefront. React + Vite front end, Express + Supabase back end.

> **Project status: front end is a working static storefront; back end is an empty scaffold.**
> Every page renders from hard-coded arrays in the component files. There is no API, no
> database, no cart persistence, and no checkout yet. See [Current state](#current-state)
> for exactly what does and does not exist.

---

## Contents

| Document | What it covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the pieces fit together and why |
| [API.md](API.md) | HTTP contract for the planned back end |
| [DATA_MODEL.md](DATA_MODEL.md) | Product/category/blog shapes, and the schema they imply |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branching, commits, review, code conventions |
| [SECURITY.md](SECURITY.md) | Reporting vulnerabilities, secret handling, known exposure |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [CLAUDE.md](CLAUDE.md) | Conventions for AI coding agents working in this repo |
| [docs/decisions/](docs/decisions/) | Why things are the way they are — context, alternatives, consequences |
| [docs/runbooks/](docs/runbooks/) | Operational procedures (deploy, rollback, secret rotation) |
| [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) | Document A (derived) — 134 functional requirements with IDs, reconstructed from Document B |
| [docs/MODULES.md](docs/MODULES.md) | The 134 requirements divided into 20 modules — boundaries, dependencies, build order |
| [docs/OPS_CONFORMANCE.md](docs/OPS_CONFORMANCE.md) | Document B (ops standard) mapped against reality, plus the staged roadmap |
| [docs/THIRD_PARTY_REGISTER.md](docs/THIRD_PARTY_REGISTER.md) | External services, criticality, credentials location, fallbacks |
| [LICENSE](LICENSE) | Proprietary — all rights reserved |

---

## Prerequisites

- **Node.js `^20.19.0` or `>=22.12.0`** — required by Vite 8. Verified on Node 22.18.0, npm 11.10.0.
- npm (bundled with Node).
- A Supabase project, once back-end work begins. Not needed to run the front end.

---

## Running the front end

```bash
cd Frontend
npm install
npm run dev
```

Vite serves on <http://localhost:5173>, or the next free port if 5173 is taken.

**The API must be running too.** The shop and home-page product grids fetch from it; without
it they show an error with a retry rather than products. Start it in a second shell — see
[Running the back end](#running-the-back-end). Everything else (hero, categories, blog,
contact) renders standalone.

| Script | Does |
|---|---|
| `npm run dev` | Dev server with hot module replacement |
| `npm run build` | Production build into `Frontend/dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | ESLint across `**/*.{js,jsx}` |
| `npm run budgets` | Enforce performance budgets against `dist/` (Doc B §12) |
| `npm run seo` | SEO health check — duplicate titles, orphaned pages, sitemap coverage (`CONT-04`) |
| `npm run seo:generate` | Write `dist/sitemap.xml` and `dist/robots.txt`; runs as part of `build` |
| `npm run optimise:images` | Re-encode `src/assets/` images; originals kept in `.image-originals/` |
| `npm test` | Unit tests (39 checks, under a second) |
| `npm run verify` | lint + unit + build + budgets + seo — run this before opening a PR |
| `npm run e2e` | Playwright end-to-end suite (297 checks; starts both servers) |

Set `VITE_API_URL` in `Frontend/.env.local` to point at a different API. It defaults to
`http://localhost:3000/api`. **Every `VITE_`-prefixed variable is public** — it is inlined
into the bundle as a string literal. Never put a secret behind that prefix.

## Running the back end

```bash
cd Backend
[ -f .env ] || cp .env.example .env   # guard: a bare cp overwrites working credentials
npm install
npm run dev               # or: npm start
```

**`PORT` comes from `Backend/.env`** and defaults to 3000 only when unset — check the port
the server logs at startup. If it is not 3000, set `VITE_API_URL` in `Frontend/.env.local`
to match, or the front end will show an error panel instead of products.

It starts without Supabase credentials — `/health` works regardless, and database access
fails at the point of use rather than at boot.

| Script | Does |
|---|---|
| `npm start` | Run the server |
| `npm run dev` | Run with nodemon reload |
| `npm test` | Unit tests for the services (34 checks) |
| `npm run smoke` | Smoke-test a running server (72 checks) |
| `npm run completeness` | Catalogue data-quality report (`CAT-04`); non-zero if a product is blocked |

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness — build SHA, config version, feature flags, uptime |
| `GET /health/ready` | Readiness — dependency checks; 503 when not ready |
| `GET /api/products` | Catalogue: `page`, `limit`, `category`, `sort`, `q`, `min_price`, `max_price` |
| `GET /api/products/featured` | The eight curated home-page products |
| `GET /api/products/:slug` | One product; 404 if absent |
| `GET /api/categories` | The seven categories, with `product_count` |
| `GET /api/posts` | Blog, paginated; plus `/recent`, `/tags` and `/:slug` |

Full contract in [API.md](API.md). Data comes from a JSON file, not a database — see
[Back-end structure](#back-end-structure).

Verify with the server running in another shell:

```bash
npm run smoke
```

---

## Current state

### What works

- Six routes — `/`, `/shop`, `/shop/:slug`, `/about`, `/contact` and a `*` catch-all —
  wired through React Router in [App.jsx](Frontend/src/App.jsx), each setting its own
  document title.
- Product detail pages backed by `GET /api/products/:slug`, distinguishing a missing
  product from a failed request.
- A guest cart at `/cart` with a live navbar badge, persisted across reloads. It stores only
  `{slug, quantity}`; prices always come from the API.
- Shop filtering, search, sorting and paging held in the URL, so a filtered view can be
  shared and the back button works.
- Responsive navbar with a mobile drawer, and a shared footer.
- Home page composed of Hero, BrowseRange, ProductsSection, RoomsInspiration and ShareSetup
  sections, wrapped in a Framer Motion scroll-in animation.
- Shop page with a 32-item catalogue paginated 16 per page.
- Contact page with a laid-out form.
- Tailwind styling throughout, plus hand-written marquee keyframes in
  [index.css](Frontend/src/index.css).

### What does not work yet

These are known gaps, not hidden bugs. Each is tracked in [CHANGELOG.md](CHANGELOG.md)
under *Unreleased*.

| Gap | Where |
|---|---|
| "Add to cart", Share, Compare and Like have no handlers; there is no cart state anywhere | [ProductCard.jsx](Frontend/src/components/ProductCard.jsx) |
| Contact form has no `onSubmit` — submitting reloads the page and discards input | [contact.jsx](Frontend/src/pages/contact.jsx) |
| Navbar user and wishlist icons are not interactive (search and cart now work) | [Navbar.jsx](Frontend/src/components/Navbar.jsx) |
| Page files are lowercase (`shop.jsx`, `about.jsx`) though their components are now PascalCase | [Frontend/src/pages/](Frontend/src/pages/) |
| `ShopBanner`, `BlogBanner` and the contact banner duplicate `PageBanner`'s markup | [Frontend/src/sections/](Frontend/src/sections/) |
| No deployment configuration, and no host chosen | repo-wide |
| Brand name spelled two ways — `Furniro` in the navbar, `Funiro` in the footer and hashtag | [Footer.jsx](Frontend/src/components/Footer.jsx) |
| `Backend/.env` rotation outstanding; whether it reached git history is unverified | [SECURITY.md](SECURITY.md) |

---

## Back-end structure

The three blockers that used to prevent the server starting are cleared: `"type": "module"`
is set, `start`/`dev` scripts exist, and `mongoose` — a MongoDB driver in a Postgres
project — is removed.

```
Backend/
├── index.js              Entry point: validate config, listen, shut down gracefully
├── src/
│   ├── app.js            Composition root — middleware order is load-bearing
│   └── platform/         Layer 0. Everything depends on this; it depends on nothing
│       ├── config.js       env loading (dotenv first), validation, warnings
│       ├── logger.js       structured logs, redaction, correlation id on every line
│       ├── correlation.js  one id per request, via AsyncLocalStorage
│       ├── errors.js       AppError + the error middleware (registered last)
│       ├── health.js       /health and /health/ready
│       ├── supabase.js     the shared client, constructed lazily
│       └── index.js        public interface — import only from here
└── scripts/smoke.mjs     end-to-end checks against a running server
```

`src/modules/catalogue/` is the first domain module, layered
`routes -> controller -> service -> repository`. **The repository is the only file that
touches a data store**, and today that store is a JSON file — there is no database schema
yet. Swapping that one file for Supabase is the entire migration.

Product data lives in `src/modules/catalogue/data/products.json` and is the single source
for the whole system. The front end fetches it; it holds no catalogue of its own.

Further modules mount into `src/app.js` as they are built. The layout, boundary rules and
build order are in [docs/MODULES.md](docs/MODULES.md).

**One data-layer decision remains.** `@supabase/supabase-js` and `pg` are both installed.
They are two routes to the same Postgres; `pg` is kept for now pending the question of
whether raw SQL is needed — see
[ARCHITECTURE.md](ARCHITECTURE.md#three-data-layers-pick-one).

## Environment variables

Back-end variables live in `Backend/.env`, which is **not** committed. Copy the template:

```bash
cd Backend
cp .env.example .env
```

| Variable | Purpose |
|---|---|
| `PORT` | Port the Express server binds to |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous (public) key |
| `DATABASE_URL` | Postgres connection string, for direct `pg` access |

`src/platform/config.js` loads dotenv at its own module top level and is imported first, so
every later module sees a populated `process.env`. Two further variables are supported:
`ALLOWED_ORIGINS` (comma-separated CORS allowlist, defaulting to `http://localhost:5173`)
and `LOG_LEVEL`.

The front end reads one variable, `VITE_API_URL` (see `Frontend/.env.example`). Vite only
exposes variables prefixed `VITE_`, and **everything so exposed is embedded in the public
bundle.** Never put a secret behind a `VITE_` prefix.

---

## Layout

```
Furniro/
├── Frontend/
│   ├── src/
│   │   ├── components/     Navbar, Footer, ProductCard, ProductGrid
│   │   ├── pages/          Route targets: HomePage, shop, about, contact
│   │   ├── sections/       Page-level blocks composed by pages
│   │   ├── assets/         Images imported by the bundler
│   │   ├── App.jsx         Route table
│   │   └── main.jsx        Entry point, mounts BrowserRouter
│   ├── public/             Served verbatim at the web root
│   └── vite.config.js
├── Backend/
│   ├── config/supabase.js  The only back-end file with code
│   ├── index.js            Empty
│   └── controllers/ models/ routes/ middlewares/ utils/   All empty
└── docs/runbooks/
```

## License

Proprietary. All rights reserved — see [LICENSE](LICENSE).
