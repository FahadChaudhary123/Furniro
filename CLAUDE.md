# CLAUDE.md

Instructions for AI coding agents working in this repository. Human contributors want
[CONTRIBUTING.md](CONTRIBUTING.md) — everything there applies here too.

---

## What this project is

Furniro, a furniture e-commerce storefront. React 19 + Vite 8 front end; Express 5 +
Supabase back end.

**The back end runs and serves the catalogue.** `Backend/src/platform/` (config, logging,
correlation ids, errors, health) and `Backend/src/modules/catalogue/` (products,
categories) are built. Nothing else is: no cart, orders, auth or payments.

**The front end fetches products from the API** via `src/modules/catalogue`. It holds no
product data of its own. Other sections (hero, categories, rooms, blog) still use inline
arrays.

Product data lives in exactly one place: `Backend/src/modules/catalogue/data/products.json`.
There is no database — the repository reads that file. Do not add a second copy anywhere.

Do not write code that assumes a database, a cart, or an authenticated user. Do not add
`fetch()` to an endpoint that is not mounted in `Backend/src/app.js`.

---

## Read before you edit

| Task | Read first |
|---|---|
| Anything at all | [README.md](README.md#current-state) — what works, what does not |
| Touching product data | Import from `src/modules/catalogue` — never redefine products |
| Touching blog/category/room data | [DATA_MODEL.md](DATA_MODEL.md) — still inline arrays |
| Adding a module | [docs/MODULES.md](docs/MODULES.md) — boundaries and dependency direction |
| Adding an endpoint | [API.md](API.md) — conventions are binding |
| Structural change | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Anything touching secrets or user input | [SECURITY.md](SECURITY.md) |

---

## Hard rules

**Never commit or print a secret.** `Backend/.env` holds live Supabase credentials,
including a `DATABASE_URL` that embeds the database password. Never read its values into
output, a commit, a log, or a doc. `.env.example` is the file to reference.

**Never give a secret a `VITE_` prefix.** Vite inlines every `VITE_`-prefixed variable into
the public bundle as a string literal. There is no way to un-publish it after a deploy.

**Never invent an endpoint.** What exists: `/health`, `/health/ready`, `/api/products`
(+`/featured`, `/:slug`), `/api/categories`, `/api/posts` (+`/recent`, `/tags`, `/:slug`).

**The cart never stores a price.** `{slug, quantity}` only; line detail is re-read from the
API. A cart holding its own price copy shows yesterday's price after a repricing, and it is
the same mistake as a client submitting an order total.

**Error middleware stays last and keeps four parameters.** Express identifies it by arity;
dropping `next` turns it into a normal handler that never runs. A 500 never returns a stack,
a SQL fragment or a driver message — log those with the correlation id.

**Never store a formatted price string or use a float for money.** Integers in minor units,
formatted at the render boundary. [Why.](DATA_MODEL.md#money)

**Never use `dangerouslySetInnerHTML`.** It is not used anywhere in this codebase and it is
the most common route to stored XSS in React. Keep it that way.

**Never bump `vite` casually.** It is pinned at `8.0.0-beta.13` through an `overrides`
block that forces the version onto transitive dependents. Betas break between releases.

**Do not run `git init`, commit, or push** unless explicitly asked. This is not yet a git
repository, and initialising it while `Backend/.env` holds live credentials risks
committing them. See [SECURITY.md](SECURITY.md#-current-exposure--act-on-this-first).

---

## Conventions

### Structure

Routes: `/`, `/shop`, `/shop/:slug`, `/about`, `/blog/:slug`, `/cart`, `/contact`, and a
`*` catch-all. Every page sets its title with `useDocumentTitle`.

```
modules/<name>/   Domain modules. Import ONLY via modules/<name>/index.js
shared/lib/       Cross-cutting helpers (money formatting)
components/       Reused presentation across pages
sections/         One full-width band of a page
pages/            One per route; composes sections, no logic
```

Dependencies flow `pages` → `sections` → `components` → `modules`, never upward.
**Never deep-import past a module's `index.js`** — that is the boundary breaking. See
[docs/MODULES.md](docs/MODULES.md#boundary-rules).

### Code

- Function components with hooks, no classes.
- `PascalCase` components and filenames. Some page files are lowercase (`shop.jsx`) — that
  is pre-existing inconsistency, not a pattern to copy.
- Hoist static data to module scope. `blogPosts` in `BlogSection.jsx` is declared inside
  the component body; do not replicate that.
- Stable `key` on every mapped element, never the array index.
- Tailwind utilities in JSX. Plain CSS in `index.css` only for what Tailwind cannot express.
- Brand gold is `#B88E2F`. (`#B88A2B` appears twice in `Hero.jsx` — that is a bug, not a second brand colour.)
- The brand is spelled **Furniro**. `Funiro` in the footer and hashtag is a leftover to fix.
- Relative imports — no path alias is configured.
- Mobile-first: unprefixed utilities are small-screen, `sm:`/`md:`/`lg:` layer on top.

### Verify before claiming done

```bash
cd Frontend && npm run verify   # lint + build + performance budgets
cd Frontend && npm run e2e      # 251 browser checks; starts both servers itself
cd Backend  && npm run smoke    # 64 API checks against a running server
```

All three must pass. **A build that succeeds is not a page that renders** — the e2e suite
exists because lint, build, budgets and every API check were green while `/shop` rendered a
blank page. There are still no unit tests.

---

## Working style

**Match the surrounding code.** This codebase has no TypeScript, no test suite and no state
library. Do not introduce one as a side effect of an unrelated task.

**Fix what you were asked to fix.** The known-issues list in
[CHANGELOG.md](CHANGELOG.md#known-issues) is long and tempting. Note what you spot; do not
opportunistically rewrite it. Unrequested refactors buried inside a bug fix make review
harder and are the fastest way to lose a reviewer's trust.

**Report accurately.** If the build fails, say so and show the output. If you skipped part
of a task, say which part and why. Never report success you have not verified — and prefer
running the check over reasoning about whether it would pass.

**Prefer the smallest change that works.** Ask whether twenty lines would do before adding
a dependency. There is precedent here for getting that wrong: `gsap` is installed for one
component nothing imports, and `mongoose` — a MongoDB driver — is a dependency of a
Postgres project.

**Say when a request rests on a wrong premise.** A task that assumes a working API or a
cart is a task built on something that is not there. Flag it, then do what can actually be
done rather than building against an imagined back end.

---

## Traps in this codebase

Specific things that have already caused, or will cause, wrong work:

1. **Products have exactly one definition** — `Backend/src/modules/catalogue/data/products.json`.
   There were once two incompatible shapes in two components, then briefly a front-end copy;
   do not reintroduce either. Prices are integer minor units, badges are derived, and the
   API returns image *keys* the client resolves. Background:
   [the conflict](DATA_MODEL.md#the-product-shape-conflict-resolved).
2. **`src/assets/` vs `public/`.** Assets under `src/assets/` are imported as modules and
   hashed by the bundler. Files in `public/` are copied verbatim and referenced by absolute
   path. Confusing the two is what broke every shop image.
3. **Import platform config before anything reads `process.env`.** `src/platform/config.js`
   loads dotenv at its own top level, and ES imports are hoisted — a `dotenv.config()`
   written below an `import` runs too late and the imported module sees `undefined`. That
   was the bug in the old `config/supabase.js`.
4. **Express 5, not 4.** Async handler rejections forward to error middleware
   automatically; the `try/catch`-and-`next(err)` wrapper is obsolete.
5. **`cors()` with no arguments reflects any origin.** Always pass an explicit allowlist.
6. **Browserslist warning after a data update** persists in any already-running dev server
   — the check runs once at process startup. Restart it rather than re-running the update.

---

## Commits

Conventional Commits, imperative subject under 72 characters, body explaining *why*. Add
the trailer when you wrote a meaningful part of a change:

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

Update [CHANGELOG.md](CHANGELOG.md) under *Unreleased* for anything user-visible, and the
relevant doc in the same change — never in a follow-up.
