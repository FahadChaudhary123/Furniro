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

| Script | Does |
|---|---|
| `npm run dev` | Dev server with hot module replacement |
| `npm run build` | Production build into `Frontend/dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run lint` | ESLint across `**/*.{js,jsx}` |
| `npm run budgets` | Enforce performance budgets against `dist/` (Doc B §12) |
| `npm run optimise:images` | Re-encode `src/assets/` images; originals kept in `.image-originals/` |
| `npm run verify` | lint + build + budgets — run this before opening a PR |

The front end makes no network calls, so it runs fully standalone.

## Running the back end

```bash
cd Backend
cp .env.example .env      # fill in values; see Environment variables below
npm install
npm run dev               # or: npm start
```

Serves on `http://localhost:3000` unless `PORT` says otherwise. It starts without Supabase
credentials — `/health` works regardless, and database access fails at the point of use
rather than at boot.

| Script | Does |
|---|---|
| `npm start` | Run the server |
| `npm run dev` | Run with nodemon reload |
| `npm run smoke` | Smoke-test a running server (46 checks) |
| `npm run check:catalogue` | Guard the front-end catalogue copy against the back end's |

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness — build SHA, config version, feature flags, uptime |
| `GET /health/ready` | Readiness — dependency checks; 503 when not ready |
| `GET /api/products` | Catalogue: `page`, `limit`, `category`, `sort`, `q`, `min_price`, `max_price` |
| `GET /api/products/featured` | The eight curated home-page products |
| `GET /api/products/:slug` | One product; 404 if absent |
| `GET /api/categories` | The seven categories, with `product_count` |

Full contract in [API.md](API.md). Data comes from a JSON file, not a database — see
[Back-end structure](#back-end-structure).

Verify with the server running in another shell:

```bash
npm run smoke
```

---

## Current state

### What works

- Four routes — `/`, `/shop`, `/about`, `/contact` — wired through React Router in
  [App.jsx](Frontend/src/App.jsx).
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
| Navbar user / search / wishlist / cart icons are not interactive | [Navbar.jsx](Frontend/src/components/Navbar.jsx) |
| `AnimationDemo.jsx` is the only `gsap` consumer and is never imported | [AnimationDemo.jsx](Frontend/src/components/AnimationDemo.jsx) |
| No tests, and no deployment configuration | repo-wide |
| Brand name spelled two ways — `Furniro` in the navbar, `Funiro` in the footer and hashtag | [Footer.jsx](Frontend/src/components/Footer.jsx) |
| Not a git repository yet — CI exists but cannot run until it is | repo root |

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

The catalogue JSON is generated from the front end's module (`npm run catalogue:generate`)
because the two are separate npm roots and cannot share a file. That duplication is
temporary — it ends when the front end fetches — and `npm run check:catalogue` guards it in
CI meanwhile.

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

The front end reads no environment variables. When it needs an API base URL, it must be
named `VITE_API_URL` — Vite only exposes variables prefixed `VITE_`, and **everything so
exposed is embedded in the public bundle.** Never put a secret behind a `VITE_` prefix.

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
#   F u r n i r o 
 
 