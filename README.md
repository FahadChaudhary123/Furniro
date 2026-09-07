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

**Not yet runnable.** `Backend/index.js` is an empty file and `package.json` defines no
`start` or `dev` script. See [Wiring up the back end](#wiring-up-the-back-end).

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
| Back end has no code — empty `index.js`; `controllers/`, `models/`, `routes/`, `middlewares/`, `utils/` are all empty directories | [Backend/](Backend/) |
| Shop product images 404 — rows reference `/images/productN.png` but `Frontend/public/` contains only `vite.svg` | [ProductGrid.jsx](Frontend/src/components/ProductGrid.jsx) |
| Sort and "show N" dropdowns are decorative — no `onChange`, no effect on the grid | [ProductGrid.jsx](Frontend/src/components/ProductGrid.jsx) |
| "Add to cart", Share, Compare and Like have no handlers; there is no cart state anywhere | [ProductCard.jsx](Frontend/src/components/ProductCard.jsx) |
| Contact form has no `onSubmit` — submitting reloads the page and discards input | [contact.jsx](Frontend/src/pages/contact.jsx) |
| Navbar user / search / wishlist / cart icons are not interactive | [Navbar.jsx](Frontend/src/components/Navbar.jsx) |
| Prices render as `Rp` for current and `Rs` for old price on the same card | [ProductCard.jsx](Frontend/src/components/ProductCard.jsx) |
| Product data exists in two incompatible shapes across two files | See [DATA_MODEL.md](DATA_MODEL.md) |
| `AnimationDemo.jsx` is the only `gsap` consumer and is never imported | [AnimationDemo.jsx](Frontend/src/components/AnimationDemo.jsx) |
| No tests, and no deployment configuration | repo-wide |
| Not a git repository yet — CI exists but cannot run until it is | repo root |

---

## Wiring up the back end

Three blockers to clear before `Backend/` will start, in order:

1. **Set `"type": "module"` in [Backend/package.json](Backend/package.json).**
   [config/supabase.js](Backend/config/supabase.js) uses `import`/`export` syntax, which
   Node parses as CommonJS without this field and rejects with `SyntaxError: Cannot use
   import statement outside a module`.

2. **Add start scripts.** There are none:

   ```json
   "scripts": {
     "start": "node index.js",
     "dev": "nodemon index.js"
   }
   ```

3. **Pick one data layer.** `@supabase/supabase-js`, `mongoose` and `pg` are all installed.
   `mongoose` is a MongoDB driver and cannot talk to Supabase; `pg` and `supabase-js` are
   two different routes to the same Postgres instance. [ARCHITECTURE.md](ARCHITECTURE.md)
   recommends keeping `supabase-js` and dropping the other two.

Then implement the endpoints in [API.md](API.md) against the schema in
[DATA_MODEL.md](DATA_MODEL.md).

---

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

`Backend/config/supabase.js` reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` from
`process.env` but nothing calls `dotenv.config()` yet — whichever module becomes the entry
point must load `dotenv` **before** importing the Supabase client, or both values will be
`undefined`.

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
#   F u r n i r o  
 