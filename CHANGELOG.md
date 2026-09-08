# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Categories: **Added**, **Changed**, **Deprecated**, **Removed**, **Fixed**, **Security**.

> No release has been tagged. The project is pre-1.0 and the API is unstable — see
> [README.md](README.md#current-state) for what does and does not work.

---

## [Unreleased]

- **The `security` module** (`Backend/src/security/`) — `SEC-04` security headers via
  helmet (CSP `default-src 'none'`, nosniff, `X-Frame-Options: DENY`, no-referrer, HSTS in
  production only) and `SEC-03` rate limiting on `/api`. The API previously sent no security
  headers at all. The 429 uses the documented error shape and carries a correlation id;
  health probes are exempt, so a throttled probe cannot read as an outage.
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

- **Discontinued products redirect instead of dying** (`CAT-08`). A product leaves the
  catalogue by failing the publish gate or by carrying `"discontinued": true`. Its slug is
  **retained** rather than dropped — a slug the server has forgotten can only 404, and Doc B
  §15 is explicit that an indexed URL should never land on one.
  `GET /api/products/:slug` now has three outcomes: `200` live, `410 Gone` with
  `redirect_to` for a product that existed and is no longer sold, and `404` for a slug that
  never existed. That last distinction is load-bearing and covered by a smoke check —
  soft-redirecting every typo to a plausible product hides broken links from the very checks
  that exist to find them.
  **The API deliberately does not answer `301`.** `fetch` follows redirects transparently, so
  a 301 there would hand the caller a different product's JSON under the URL it asked for,
  with nothing reporting the substitution. The 301 belongs on the page URL, so `npm run build`
  now writes `dist/_redirects` from the same `listRedirects()` the API answers with — one
  definition, so the redirect map cannot disagree with the API about where a product went.
  The sitemap drops discontinued URLs too; advertising a URL that answers 410 is a crawl
  error per page.
  "Nearest live alternative" is a judgement, not a fact: newest live product in the same
  category, then the category listing, then `/shop`. Without a successor field in the data,
  recency is the best proxy available for "the thing that replaced it".
  Verified end to end by discontinuing a product temporarily: 410 with the right target, the
  page redirected with `replace` so the back button does not trap the visitor, the sitemap
  fell from 44 to 43 URLs, and `_redirects` gained the rule. The flag was then reverted —
  **no product is currently discontinued**, and `redirect.test.js` asserts that, so setting
  it changes a test result rather than changing the live sitemap silently.
- **An API latency benchmark** (`NFR-04`) — `Backend/scripts/latency.mjs`, `npm run latency`.
  Measures p50/p95/p99 across every catalogue and content endpoint and runs in CI on its own
  port, so the smoke server's rate limits stay untouched and its `SEC-03` checks keep meaning
  what they say.
  **Local p95 is about 1.4 ms against Doc B's 400 ms, and that does not demonstrate the SLO.**
  It is a loopback request to an in-memory array; production latency is dominated by a
  database round trip that does not exist yet. The script prints that caveat on every run,
  and the enforced budget is a local 50 ms rather than the SLO — a loopback request to an
  in-memory store that takes 50 ms has a problem no infrastructure will fix.
  What it actually buys now is an algorithmic regression guard: filtering, sorting and paging
  run over every product on every request, so an accidental O(n²) is invisible at 40 products
  and fatal at 40,000. The run compares a 100-item page against the default and fails above
  10x. Currently 1.0x.
  Two guards on the benchmark itself, both verified by triggering them: it aborts on a 429
  rather than reporting a fast average of rejections (the run sends ~2400 requests and
  throttles itself against the default limit), and it checks every URL returns 2xx before
  timing anything — a mistyped `sort=price_desc` measured the validation error path and
  passed its budget comfortably.
- **Automated accessibility checks** (`NFR-10`) — `axe-core` over the purchase path at both
  the desktop and mobile viewports, failing CI on any WCAG 2.1 A/AA violation.
  See [ADR 0011](docs/decisions/0011-automated-accessibility-checks.md) for why a 3 MB
  devDependency was accepted in a project that has removed four dependencies for less.

### Fixed

- **83 accessibility violations found; 75 fixed.** None of these were visible by eye:
  - **The mobile menu button had no accessible name** — announced as just "button", on the
    one control that reaches every other page on a phone. It is `md:hidden`, so a
    desktop-only scan never sees it. It now has a label, `aria-expanded`, `aria-controls`,
    and a visible focus ring to replace the `focus:outline-none` that removed it.
  - **Every page had two `<h1>`s.** The footer brand mark was one, so "jump to main heading"
    landed in the footer half the time. It is a `<p>` now, styled identically.
  - **Three carousel dots were unlabelled**, announced as "button, button, button". They now
    name the slide they select and mark the current one with `aria-current`.
  - **Body text below the contrast minimum** — `text-gray-400` at 2.53:1 on white, and
    `text-gray-500` at 4.43:1 on the grey card background against a 4.5:1 requirement.
  - **Five badge and button fills too light for white text** — `red-400` (2.76:1),
    `teal-400` (1.86:1), `emerald-500` (2.53:1), `red-500` (3.76:1), `yellow-600` (2.93:1).

  The 8 remaining are all the brand gold `#B88E2F` at **3.02:1 on white** — passing AA for
  large text, failing it for normal text, on primary buttons sitewide. Left alone
  deliberately: changing a brand colour is a design decision, not a defect fix. The suite
  caps the count so the gold cannot spread further while the decision is open; raising that
  cap is not the remedy.
- **Broken-link and link-quality checks** (`CONT-03`) — `Frontend/e2e/links.spec.js`. The
  suite crawls every page, collects every link instance, and follows each internal one,
  failing if it lands on the 404 page. It also rejects a link to a product the publish gate
  blocks, a link with no accessible name, and `target="_blank"` without `rel="noopener"`.
  It runs in a browser because it has to: links live in React components and exist only
  after the app renders, so a static checker parsing `dist/index.html` finds one
  `<div id="root">` and reports a clean site with every link on it broken. "Resolves" also
  cannot mean HTTP 200 — an SPA returns 200 for `/shopp` as well — so the signal is landing
  on the 404 page, which is what a visitor actually experiences.
  Verified by injecting three faults into the footer (a dead route, an unlabelled link, an
  unprotected new tab) and confirming each was caught and located, then reverting.

### Fixed

- **Placeholder blog posts were excluded from the sitemap but still indexable.** The
  generated sitemap leaves them out as thin content, but three pages link to each one, so a
  crawler reaches them anyway and the exclusion achieved nothing. `/blog/:slug` now emits
  `noindex` for a post carrying `_placeholder`, so the two rules agree; clearing the flag in
  `posts.json` publishes a post in both places at once.
- **Per-page SEO metadata, a generated sitemap, and an SEO health check** (`CONT-04`).
  Every static route is now declared once in `Frontend/src/shared/lib/routes.js`, and the
  page meta, the sitemap and the audit all read that one manifest instead of three lists
  that drift.
  `usePageMeta` replaces `useDocumentTitle` and sets the four things a crawler reads: title,
  meta description, canonical URL and robots. It restores every tag on unmount — a `noindex`
  left behind by the 404 page would have marked every subsequent route `noindex`, which
  removes a site from search results and is invisible in development.
  Canonical URLs drop the query string, so `/shop?category=dining&page=2` and
  `/shop?page=2&category=dining` collapse into one page rather than reading as two pages of
  duplicate content. `/cart`, unknown product slugs and the 404 page emit `noindex` — an SPA
  answers HTTP 200 for every path, so without it every typo becomes an indexed page.
  `dist/sitemap.xml` and `dist/robots.txt` are generated at build time from the same product
  file the API serves, excluding products the publish gate blocks: a sitemap advertising URLs
  the server 404s is a crawl error per page. Generated into `dist/` rather than committed to
  `public/`, because a checked-in sitemap is stale the moment a product is added.
  `npm run seo` audits the manifest against `App.jsx` and the sitemap and fails CI on a
  duplicate title, an orphaned page, a phantom route, a `noindex` page in the sitemap or a
  sitemap of localhost URLs. 22 browser checks assert the rendered head, not just the source.
- **A catalogue publish gate and completeness report** (`CAT-03`, `CAT-04`) —
  `Backend/src/modules/catalogue/publishGate.js` is the single definition of what makes a
  product complete, applied by the repository at load so no read path can bypass it.
  Rules carry one of two severities. A product that would render visibly broken — no slug,
  a non-integer price, a missing image, an unknown category — is **blocked** and served
  nowhere: not on a listing, not by slug, not as featured. One that renders but is missing
  something needed to sell or index it **warns** and stays visible.
  That split is the point. Unpublishing a live slug turns it into a 404 on an indexed URL,
  which is the failure Doc B §15 warns about, so blocking is reserved for the case where
  showing the product is worse than hiding it.
  `npm run completeness` prints the report (`--json` for a dashboard, `--strict` to fail on
  warnings) and exits non-zero on any blocking failure, so CI fails the build rather than
  starting Doc B's 14-day resolution clock. Verified by breaking two products deliberately:
  the boot log named them, both returned 404, and the listing total fell from 40 to 38.
  `CAT-01` stays partial — `tax_class`, `weight`, `seo_title` and `seo_description` are
  absent from every product, so the report lists them once as a catalogue-wide gap rather
  than as forty identical failures. They are reported, not invented: a guessed shipping
  weight is worse than a blank because it looks authoritative to whoever rates the shipment.
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

- **The smoke suite reported a CORS defect that was really a test defect.** The check
  hardcoded `http://localhost:5173` as the allowed origin, so it failed against any server
  whose allowlist had been configured to anything else — including the one used to demo the
  app. It now reads `ALLOWED_ORIGINS` from the same source the server does, the way the
  `PORT` fix already did, and names the expected origin when it fails. `ALLOWED_ORIGINS` and
  `LOG_LEVEL` are also set in `Backend/.env` rather than being supplied ad hoc per shell, so
  the documented `npm run dev` reproduces the configuration the smoke suite asserts.
- **`toMinorUnits` silently lost a unit at floating-point half-boundaries.**
  `1.005 * 100` is `100.49999999999999`, so `Math.round` returned 100. Whole-rupiah prices —
  everything currently authored — were unaffected, but the helper was a trap for the next
  person to reach for it. Found by a unit test; invisible to the browser suite.
- **The documented local setup did not work.** Executing
  `docs/runbooks/local-development.md` as written — Doc B §18's monthly runbook test, never
  done before — found the API binds to `PORT` from `.env` (5000 here) while both the front
  end and the smoke suite assumed 3000. `npm run smoke` failed outright and the storefront
  showed an error panel instead of products. The smoke suite now reads `.env`, and an
  unreachable API names the URL it tried rather than reporting a generic outage.
- **The runbook told you to overwrite your own credentials.** `cp .env.example .env`, run
  literally on a machine that already has a populated `.env`, replaces working values with
  the empty template. Guarded with `[ -f .env ] ||`.
- **The home page's featured products stopped loading** when image resolvers began returning
  `{src, webp}`: `ProductsSection` still passed the whole object to `<img src>`, so every
  featured image 404'd. The same class of bug as the category object that blanked `/shop` —
  a shape change applied to some consumers but not all.
- **A failed route chunk blanked the entire site.** With code splitting and no error
  boundary, a rejected `import()` propagated past Suspense and React unmounted the whole
  tree — navbar included — to a white page. This is the standard post-deploy failure: a
  visitor holding the previous HTML requests a chunk filename that no longer exists, gets a
  404, and the site disappears. `RouteErrorBoundary` now keeps the shell and offers a reload,
  which is the correct remedy for a stale chunk.
- **The API rate limiter could be bypassed over IPv6.** A custom `keyGenerator` using
  `req.ip` keyed on the full address, so a single IPv6 allocation — billions of addresses —
  looked like unlimited distinct clients. `express-rate-limit` logged
  `ERR_ERL_KEY_GEN_IPV6` at startup and kept serving, so every request-level check still
  passed. Removed the override; the default groups IPv6 by /64.
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


- **No deployment configuration** for either tier, and no host chosen.
- **Whether `Backend/.env` ever reached git history is unverified.** Rotation is outstanding
  regardless — see [SECURITY.md](SECURITY.md#-current-exposure--act-on-this-first).

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
