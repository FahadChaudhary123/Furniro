# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Categories: **Added**, **Changed**, **Deprecated**, **Removed**, **Fixed**, **Security**.

> No release has been tagged. The project is pre-1.0 and the API is unstable — see
> [README.md](README.md#current-state) for what does and does not work.

---

## [Unreleased]

### Added

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
  runbooks R1-R12. **4 of 134 are currently met.** Marked Rev 0.1 draft — a straw man to
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
  only because the project is not yet a git repository.
- **23 dependency vulnerabilities resolved** — 15 in `Frontend/` (10 high) and 8 in
  `Backend/` (5 high), all via non-breaking `npm audit fix`. Both packages now report zero.
  Surfaced by the new CI audit gate, which was red on arrival. Most were dev-only, but
  `react-router-dom` (7.13.0 -> 7.18.3) is a runtime dependency that shipped to users.
  Doc B §10 requires high severity patched within 7 days.
- **Action still outstanding: rotate `SUPABASE_ANON_KEY` and `DATABASE_URL`** before the
  first commit. See [SECURITY.md](SECURITY.md#-current-exposure--act-on-this-first) and
  [docs/runbooks/secret-rotation.md](docs/runbooks/secret-rotation.md).

### Changed

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

- **All shop product images 404.** Rows reference `/images/productN.png`, resolved against
  `Frontend/public/`, which contains only `vite.svg`. The real assets are at
  `src/assets/Products/*.jpg`. — [ProductGrid.jsx](Frontend/src/components/ProductGrid.jsx)
- **Two currencies on one card.** Current price renders `Rp`, old price renders `Rs`. —
  [ProductCard.jsx](Frontend/src/components/ProductCard.jsx)
- **Sort and "show N" dropdowns do nothing** — no `onChange`, and prices are formatted
  strings that cannot be sorted anyway.
- **No cart.** "Add to cart", Share, Compare and Like have no handlers and there is no cart
  state anywhere in the app.
- **Contact form discards input** — no `onSubmit`, so the page reloads and the message is
  lost. — [contact.jsx](Frontend/src/pages/contact.jsx)
- **Navbar user, search, wishlist and cart icons are not interactive.**
- **No 404 route.** An unknown path renders the navbar and blank space.
- **Product data exists in two incompatible shapes** across `ProductGrid.jsx` and
  `ProductsSection.jsx`. — [DATA_MODEL.md](DATA_MODEL.md#-the-product-shape-conflict)
- **`Footer` duplicated** across all four pages instead of sitting in `App.jsx`.
- **Page title is still `frontend`** in `index.html`.

### Back end

- **No code.** `index.js` is empty; `controllers/`, `models/`, `routes/`, `middlewares/`
  and `utils/` are empty directories.
- **`config/supabase.js` cannot load** — it uses ESM syntax while `package.json` omits
  `"type": "module"`.
- **No `dotenv.config()` call**, so `SUPABASE_URL` and `SUPABASE_ANON_KEY` would both be
  `undefined` at client construction.
- **No start scripts** — neither `start` nor `dev` is defined.
- **Three overlapping data layers installed** — `@supabase/supabase-js`, `pg` and
  `mongoose`. `mongoose` is a MongoDB driver and cannot reach Postgres at all.

### Repository

- **Not a git repository.** No version control, so no history, no branches, no review.
- **No tests.** CI now exists but runs no test suite — there is none to run.
- **No deployment configuration** for either tier.
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
