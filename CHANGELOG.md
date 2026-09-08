# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Categories: **Added**, **Changed**, **Deprecated**, **Removed**, **Fixed**, **Security**.

> No release has been tagged. The project is pre-1.0 and the API is unstable — see
> [README.md](README.md#current-state) for what does and does not work.

---

## [Unreleased]

- **Shop filtering, search and sorting, all driven by the URL** (`SRCH-07`). Category
  chips with live counts, a search box, sort and page size — every one a parameter the API
  already validated. A filtered view is now shareable and bookmarkable, and the browser's
  back button works through filter changes. Defaults are kept out of the URL.
- **A guest cart** (`CART-01`) — `Frontend/src/modules/cart/`. Add, change quantity, remove
  and clear, with a live navbar badge and a `/cart` page. Survives a reload via
  `localStorage`.
  **It stores only `{slug, quantity}`** — never a price, name or image. Line detail is
  re-read from the API on every load, so the cart cannot show a stale price, and the
  subtotal is a display figure that is never submitted anywhere.
  The three "Add to cart" buttons that had done nothing since the project began now work.
- `GET /api/products?slugs=a,b,c` — batch lookup so the cart hydrates in one request rather
  than N. Capped at 50; an unknown slug is absent rather than an error.

### Added

- **The `content` module** — the blog now comes from `GET /api/posts`, with `/recent`,
  `/tags` and `/:slug`. Backend at `Backend/src/modules/content/`, front end at
  `Frontend/src/modules/content/`, same layering and boundary rules as `catalogue`.
- **Blog post pages** at `/blog/:slug`, distinguishing a missing article from a failed
  request. Post bodies render as escaped paragraphs — never through
  `dangerouslySetInnerHTML`, which would be a stored-XSS route once posts are CMS-authored.
- **Product detail pages** at `/shop/:slug` (`CAT-07`) — the first consumer of
  `GET /api/products/:slug`, which had been built and smoke-tested but unused. Slug rather
  than id, so URLs survive a reseed. A missing product is presented as a missing product,
  not as a site failure: no error panel, no retry, a route back to the shop.
- **A 404 page and a `*` catch-all route.** An unknown path previously rendered the navbar
  and nothing else — a blank page reading as a broken site rather than a wrong address.
- **Per-page document titles** via `shared/lib/useDocumentTitle`. Every route shared one
  title before, so tabs, bookmarks and history entries were indistinguishable.
- `components/PageBanner.jsx` — title plus breadcrumb, used by the new pages. `ShopBanner`,
  `BlogBanner` and the contact page still hand-roll the same markup; adopting it there is
  separate cleanup.
- **End-to-end test suite** (`npm run e2e`) — Playwright, across desktop and a Pixel 5
  viewport, running against the production build with both servers started by the config.
  Started at 123 checks and has grown with each module since. Covers the catalogue contract, image decoding, derived badges, sorting,
  pagination, routing, the SPA rewrite, mobile drawer, console errors, failed requests, alt
  text, third-party scripts, and API-failure handling. Now a CI gate.
- **The front end now fetches products from the API.** `useProducts()` and
  `useFeaturedProducts()` in `Frontend/src/modules/catalogue` replace the local data
  import, with abortable requests, loading skeletons, and an error state carrying a retry
  and the server correlation id. Paging, sorting and page size are now server-side
  parameters rather than client-side array operations.
- `Frontend/src/modules/catalogue/images.js` — resolves the image *keys* the API returns
  (`products/product1.jpg`) into hashed bundled assets via `import.meta.glob`, so the API
  stays storage-agnostic and no path is baked into the data.
- `Frontend/.env.example` documenting `VITE_API_URL` and the rule that every `VITE_`
  variable is public.
- **The catalogue API is live** — the first domain module.
  `GET /api/products` (pagination, category filter, text search, price range, whitelisted
  sort), `/api/products/featured`, `/api/products/:slug`, `/api/categories` with
  `product_count`. Layered `routes -> controller -> service -> repository` per
  docs/MODULES.md, with the repository as the only data-touching file — swapping it for
  Supabase is the whole migration.
- **Smoke suite grew to cover the catalogue contract** — 29 new checks: response
  envelope, integer prices, embedded category objects, absence of a stored badge field,
  pagination boundaries, sort ordering, filters, and five validation rejections including
  an injection-shaped `sort`.
- **The back end runs.** `Backend/src/platform/` implements the Layer 0 platform module
  from docs/MODULES.md — `PLAT-01` health endpoint (build SHA, config version, feature
  flags, uptime, plus a separate readiness probe), `PLAT-02` correlation ids via
  `AsyncLocalStorage`, `PLAT-03` structured logging with key redaction, `PLAT-04` error
  handling using the docs/API.md error shape. Plus a CORS allowlist read from
  `ALLOWED_ORIGINS`, a 100 kB body limit, and graceful shutdown on SIGTERM/SIGINT.
- `Backend/scripts/smoke.mjs` (`npm run smoke`) — 17 end-to-end checks against a running
  server: health, correlation echo and rejection, error shape, credential leakage, CORS
  allow and deny, framework fingerprinting. All 17 pass.
- **CI pipeline** (`.github/workflows/ci.yml`) — Document B §3 gates, reduced to those
  enforceable today: lint, build, performance budgets, `npm audit` (blocking on high and
  critical, across both packages), and a `gitleaks` secret scan plus an explicit check that
  no `.env` is tracked. Activates on the first push; the repo is not yet initialised.
- **Performance budget gate** (`Frontend/scripts/check-budgets.mjs`, `npm run budgets`) —
  Document B §12. Enforces gzipped JS/CSS, total asset weight, largest single asset, and
  third-party script count.
- **Image optimiser** (`Frontend/scripts/optimise-images.mjs`, `npm run optimise:images`).
- `npm run verify` in `Frontend/` — lint, build and budgets in one command.
- Project documentation: `README.md`, `ARCHITECTURE.md`, `API.md`, `DATA_MODEL.md`,
  `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, `CLAUDE.md`, `AGENTS.md`, and operational
  runbooks under `docs/runbooks/`.
- `Backend/.env.example` documenting the four required environment variables, with which
  are safe to expose and which are not.
- `docs/OPS_CONFORMANCE.md` — conformance assessment against Document B (*E-commerce
  maintenance and operations runbook*, Rev 1.0), section by section, with a staged
  adoption roadmap. 3 of 20 sections are adoptable now, 6 partially, 7 blocked on systems
  that do not exist, 4 not applicable at this scope.
- `docs/THIRD_PARTY_REGISTER.md` — external dependency register required by Document B
  §16. One live row (Supabase), with its five register gaps named.
- `docs/REQUIREMENTS.md` — **Document A, reconstructed.** The original was not supplied;
  Document B was provided in its place and confirmed as the requirements document, so the
  functional requirements were derived from the operations it prescribes. 134 requirements
  across 18 domains, each cited to the Doc B section implying it, with stable IDs so Doc B
  §16 and §17 cross-references resolve. Includes a traceability matrix covering all twelve
  runbooks R1-R12. **7 of 134 are currently met** (4 at the time of writing; the platform module added 3). Marked Rev 0.1 draft — a straw man to
  correct, not agreed scope.
- `docs/MODULES.md` — the 134 requirements divided into **20 modules** across six layers,
  with boundary rules, a dependency graph, per-module ownership and runbooks, repository
  layout, and a build order. Allocation verified complete and non-overlapping. Records the
  architectural decision to build a modular monolith rather than ~20 services, and
  identifies the eight-module minimum path to taking a first order.

### Security

- Added `.gitignore` at the repository root and in `Backend/` and `Frontend/`, covering
  `.env` and its variants. `Backend/.gitignore` previously existed but was **empty**, and
  `Backend/.env` holds live Supabase and Postgres credentials — including a `DATABASE_URL`
  that embeds the database password and bypasses row-level security. Nothing had leaked
  only because the project was not a git repository at the time. It is now, so whether
  `.env` reached the history needs verifying — see SECURITY.md.
- **23 dependency vulnerabilities resolved** — 15 in `Frontend/` (10 high) and 8 in
  `Backend/` (5 high), all via non-breaking `npm audit fix`. Both packages now report zero.
  Surfaced by the new CI audit gate, which was red on arrival. Most were dev-only, but
  `react-router-dom` (7.13.0 -> 7.18.3) is a runtime dependency that shipped to users.
  Doc B §10 requires high severity patched within 7 days.
- **Action still outstanding: rotate `SUPABASE_ANON_KEY` and `DATABASE_URL`** before the
  first commit. See [SECURITY.md](SECURITY.md#-current-exposure--act-on-this-first) and
  [docs/runbooks/secret-rotation.md](docs/runbooks/secret-rotation.md).

### Changed

- `shop.jsx` and `about.jsx` exported lowercase-named functions (`function shop()`), which
  React's rules-of-hooks does not recognise as components — adding a hook to them was a lint
  error. Renamed to `Shop` and `About`. The **filenames** are still lowercase: a case-only
  rename with no version control is risky, so that is left as separate cleanup.
- **Catalogue reconciled into one module.** `Frontend/src/modules/catalogue/` is now the
  single source of product data: 40 products in one canonical shape, consumed by both the
  shop grid and the home-page strip. Replaces two incompatible inline arrays (`title` vs
  `name`, numeric vs formatted prices, disjoint product sets). Exposed through
  `modules/catalogue/index.js` only, per docs/MODULES.md#boundary-rules.
- **Prices are integer minor units**, formatted at the render boundary by
  `Frontend/src/shared/lib/money.js`. No formatted price strings remain in data.
- **Badges are derived, not stored** (`modules/catalogue/lib/badge.js`).
- Shop sort and page-size controls are now functional. They could not have worked before:
  prices were formatted strings, which cannot be sorted.
- Home-page "Show More" is now a link to `/shop`; it was an inert `<button>`.
- Product images carry `loading="lazy"`.
- **Images optimised: 24.0 MB -> 2.51 MB of shipped assets (90% smaller).** Source images
  were camera-resolution originals (one 6000x6000, one 5616x3744) served verbatim. Resized
  to a 1600px max edge and re-encoded via `Frontend/scripts/optimise-images.mjs`. Originals
  preserved in `Frontend/.image-originals/` (gitignored); the script always re-encodes from
  those, so repeat runs do not compound JPEG loss.
- `hero-bg.png` -> `hero-bg.jpg`: a photograph with no alpha channel stored as PNG.
  **1.27 MB -> 69 kB** for one changed import in `Hero.jsx`. The PNG was removed; its
  original is in `.image-originals/`.
- Incident severity model in `docs/runbooks/incident-response.md` aligned to Document B §6
  (Sev 1–4, acknowledgement targets, communication expectations), with the caveat that no
  on-call rota exists to meet them.

### Fixed

- **The category link on every product page did nothing.** It pointed at
  `/shop?category=…`, but the grid kept its state in `useState` and never read the query
  string, so the click silently no-opped. Introduced when product detail pages landed.
- **The navbar search icon did nothing** since the project began. It now reaches the shop's
  search.
- **CI's front-end job failed at the end-to-end step** with
  `ERR_MODULE_NOT_FOUND: express`. The Playwright config starts the API itself, but the job
  installed only the front end's dependencies, so the API could not boot. It now runs
  `npm ci` in `Backend/` too, caches both lockfiles, and the job is renamed to say it runs
  end-to-end tests. Reproduced locally by moving `Backend/node_modules` aside — same error,
  same stack.
- **A mobile user could not remove an item from their cart.** At a 393px viewport the cart
  table's columns crushed together until the quantity input overlapped the remove button and
  swallowed its clicks. The table now reflows into stacked rows below `md`. Found by the
  Playwright mobile project — it is invisible at desktop width.
- **The blog sidebar shipped placeholder content to production** — five copies of "Sample
  blog title here" dated 03 Aug 2022. It now lists real posts that link to them.
- **The blog category counts were fabricated.** Crafts 2, Design 8, Handmade 7, Interior 1,
  Wood 6 — hard-coded against three real posts. They are now derived from the posts, so
  they cannot be wrong.
- **Blog dates were display strings** (`"14 Oct 2022"`), which cannot be sorted or compared.
  Stored as dates, formatted at render, and emitted in a `<time datetime>` element.
- **Blog posts were declared inside the component body**, reallocating on every render, and
  keyed by array index.
- **The document title was `frontend`** on every page, including production.
- **`ProductCard` exposed two links to the same product** — the image and the title — so
  screen-reader and keyboard users met the same destination twice per card. The image link
  is now `aria-hidden` and out of the tab order.
- **`/shop` rendered a completely blank page.** The API embeds `category` as an object
  (`{id, slug, name}`) per docs/API.md, but `ProductCard` still rendered it as a string.
  React threw error #31 ("Objects are not valid as a React child"), which unmounted the
  entire tree — no navbar, no footer, nothing. Lint, build, performance budgets and all 46
  API smoke checks were green throughout; only a real browser caught it.
- **The three blockers preventing the back end from starting.** `"type": "module"` added
  (`config/supabase.js` used ESM syntax in a package Node parsed as CommonJS); `start` and
  `dev` scripts added (there were none); `mongoose` removed — a MongoDB driver in a
  Postgres project, which could never have connected.
- **The Supabase client constructed itself at import time from unloaded env vars**, so both
  values would have been `undefined`. It is now constructed lazily and throws a directed
  error at the point of use.
- **All 32 shop product images 404'd; now every image resolves.** Rows referenced
  `/images/productN.png` against a `public/` directory holding only `vite.svg`. They now
  reference the real bundled assets. Verified by fetching all 8 from a production build.
- **Two currencies on one card.** Current price rendered `Rp`, struck-through old price
  rendered `Rs`. Both now go through one formatter.
- **Two discount badges were wrong**, which is what derived badges prevent: Syltherine was
  labelled `-30%` on a 2.5M/3.5M pair that is `-29%`, and the fabric recliner was labelled
  `-10%` on a genuine `-13%`.
- **`npm run lint` now passes; it was failing before this change.** Two `no-unused-vars`
  errors on `motion` in `HomePage.jsx` and `AnimationDemo.jsx` were false positives: the
  binding is used only as `<motion.section>`, and the flat config had no
  `eslint-plugin-react`, so JSX member-expression usage was invisible to the core rule.
  Capitalised imports escaped it via `varsIgnorePattern: '^[A-Z_]'`; lowercase `motion` did
  not. Added `eslint-plugin-react` and enabled `react/jsx-uses-vars`.
- Updated `caniuse-lite` from `1.0.30001769` to `1.0.30001810` in `Frontend/`, clearing the
  `browsers data (caniuse-lite) is 8 months old` warning on every build. No target browser
  changes, so build output is unaffected.

---

## Known issues

Carried forward until fixed. Each is a real defect, not a missing feature.

### Front end

- **Cart is guest-only and client-side.** No reservation (`CART-03`), no server-side
  persistence or retention (`CART-04`), and it does not follow a customer across devices
  (`CART-05`). Share, Compare and Like still have no handlers.
- **Contact form discards input** — no `onSubmit`, so the page reloads and the message is
  lost. — [contact.jsx](Frontend/src/pages/contact.jsx)
- **Navbar user and wishlist icons are not interactive.** Search and cart now work.
- **`Footer` duplicated** across all four pages instead of sitting in `App.jsx`.
- **The brand name is spelled two ways.** `Furniro` in the navbar and repo; `Funiro` in the
  footer heading, the copyright line and the `#FuniroFurniture` hashtag.
- **Two brand golds in use** — `#B88E2F` (18 occurrences) and `#B88A2B` (2, in the Hero).

### Back end

- **No domain endpoints yet.** Only `/health` and `/health/ready`. Products, cart, orders
  and auth are unbuilt — see [docs/MODULES.md](docs/MODULES.md#build-order).
- **Two overlapping data layers still installed** — `@supabase/supabase-js` and `pg`. Both
  reach the same Postgres; the choice is pending.
- **Graceful shutdown is unverified on Windows.** The SIGTERM/SIGINT handlers are written,
  but `Stop-Process` is a hard terminate, so the path has only been exercised by
  inspection. It matters in a Linux container, not locally.
- **No error-tracking or uptime monitoring integration** — `PLAT-04` is the middleware only.

### Repository

- **No tests.** CI now exists but runs no test suite — there is none to run.
- **No deployment configuration** for either tier, and no host chosen.
- **Whether `Backend/.env` ever reached git history is unverified.** Rotation is outstanding
  regardless — see [SECURITY.md](SECURITY.md#-current-exposure--act-on-this-first).
- **`gsap` is dead weight** — its only consumer, `AnimationDemo.jsx`, is never imported.

---

## Release process

1. Move everything under *Unreleased* into a new `## [x.y.z] — YYYY-MM-DD` section.
2. Bump the version in the relevant `package.json`.
3. Tag: `git tag -a vx.y.z -m "Release vx.y.z"`.
4. Leave a fresh empty *Unreleased* section at the top.

**Versioning:** `MAJOR` for breaking changes to the API or a data shape, `MINOR` for
backwards-compatible features, `PATCH` for backwards-compatible fixes. While at `0.y.z`,
anything may change — say so plainly rather than pretending to stability the project does
not have.

Write entries for the person reading them, not for the person who wrote the code. "Fixed
shop images that returned 404" beats "fixed ProductGrid".
