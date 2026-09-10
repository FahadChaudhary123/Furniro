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

- **The graceful-shutdown path is tested** — `Backend/src/platform/shutdown.js`, extracted
  from `index.js` so it can be, with 10 checks covering a clean close, an in-flight request
  being waited for, an idle keep-alive connection not being waited for, the timeout backstop
  exiting 1, and a second signal exiting immediately rather than closing the server twice.
  It was recorded as "unverified" because the only way to exercise it inline was to send a
  real signal, and Windows has no way to do that — a limitation confirmed rather than assumed
  (`child.kill('SIGINT')` killed the process in 10 ms with no handler run). Extracting the
  logic makes the behaviour checkable on any platform; **signal delivery remains an operating
  system concern and is still untested here.**

- **`react/jsx-no-undef` is now an error.** `<Foo />` with `Foo` out of scope — a removed or
  mistyped component import — was reported by nothing: `varsIgnorePattern: '^[A-Z_]'`
  silences core `no-unused-vars` for capitalised names, and esbuild does not resolve JSX
  identifiers, so the first sign was a blank page at runtime. Found the honest way: while
  folding the banners together, an import was replaced and one `<ShopBanner/>` left behind,
  and both `npm run lint` and `npm run build` passed on a page that could only throw.

### Removed

- **`pg`, 604 kB of `node_modules` imported by nothing.** It was framed in three documents as
  "a data-layer decision pending" — `@supabase/supabase-js` and `pg` both installed, two
  routes to the same Postgres. It was not a decision: one is used at
  `src/platform/supabase.js` and the other appeared in no file in the repository. Removing it
  does not foreclose raw SQL, since `npm install pg` restores it in one command and
  `repository.js` is the only file that would change.

- **Five empty directories.** `controllers/`, `models/`, `routes/`, `middlewares/` and
  `utils/` declared a conventional layered Express app and then never held a file, while the
  real code was written in `src/`. `ARCHITECTURE.md` still documented them as the structure
  and `README.md`'s tree still described the back end as "`config/supabase.js` — the only
  back-end file with code". An empty directory that a document calls the architecture is
  worse than no directory: it is where the next person looks first.

### Changed

- **Page filenames are `PascalCase` without exception.** `shop.jsx`, `about.jsx` and
  `contact.jsx` are now `Shop.jsx`, `About.jsx` and `Contact.jsx`; the exported component
  names were already correct, only the files were out of step. The caveat in `CLAUDE.md`
  telling agents not to copy the inconsistency is gone with it.
  This renamed the lazy-loaded chunks — Vite derives a chunk's name from its page component's
  file — which broke five patterns in `performance.spec.js` that matched `/assets/shop-`.
  The e2e suite caught it; the patterns are case-insensitive now, with a note that matching a
  chunk by filename is a coupling worth avoiding if it bites again.

- **The incident runbook described a system that no longer exists**, corrected after the
  tabletop above. It claimed there was "no API yet"; three of its seven listed gaps had
  stopped being true (tests and CI exist, structured logging exists, and error *tracking*
  now exists — what is missing is alerting). Its CORS section now records what an operator
  will actually see, verified by inducing it: the console message, the page's error state,
  the single WARN line, and the fact that the request is a 200 without a header rather than a
  5xx. `API.md` likewise still said `cors` was "currently unconfigured".
  A runbook that is wrong is followed with confidence, which is the dangerous kind of wrong.

- **The Document B conformance assessment was materially wrong in two places** and is now
  corrected against the code, in [docs/OPS_CONFORMANCE.md](docs/OPS_CONFORMANCE.md):
  - **§11 Privacy** claimed "nothing is collected" and that the section would apply "from the
    commit that gives the contact form an `onSubmit`". Both are false: five processing
    activities exist, and that form is now disabled rather than wired up. Moved from blocked
    to partial. A conformance document exists to prevent exactly this kind of stale
    assurance.
  - **§5 Monitoring** claimed nothing was measurable. Client and server errors are collected
    and catalogue latency is measured. Moved from blocked to partial — alerting is still
    missing, and a log is a record rather than a page.
  - §4's count of applicable calendar items and §12's budget figures were both out of date;
    the §12 table now carries figures from an actual `npm run budgets` run and a note that
    the budgets have been ratcheted twice.

- **Three copies of the banner became one.** `ShopBanner`, `BlogBanner` and an inline block
  on the contact page all hand-rolled `PageBanner`'s markup with a different string. Both
  section components are deleted.
  This was an accessibility fix as much as a deduplication: each copy rendered its breadcrumb
  as a plain `<p>` — "Home > Shop" as text, with no link back and nothing marking the current
  page — and labelled the decorative logo `alt="icon"`, which a screen reader reads aloud.
  All three pages now have a real `<nav aria-label="Breadcrumb">` with a working Home link
  and `aria-current="page"`.
- **A search that finds nothing now offers a way out** (`SRCH-06`). It was one line of grey
  text: a customer searching for something the shop does not stock hit a dead end whose only
  exit was the back button. They are now offered the routes onward — drop the category, clear
  the search, or browse any stocked room, with counts.
  The narrower filter is offered first: someone searching inside Bedroom most likely wants
  the search, not the room. **Nothing is applied automatically.** Silently widening a search
  and showing different products is worse than showing none, because the results then read as
  an answer to the question the customer actually asked — there is a test asserting the page
  does not do it.

- **Zero-result searches are logged for review** (`SRCH-05`) — message
  `search returned nothing`, with the term and the active category.
  This is a **deliberate exception** to the rule that query strings stay out of logs, and it
  is recorded as [activity 5 in the processing register](docs/PROCESSING_REGISTER.md) as part
  of this change rather than after it. It earns the exception because a search returning
  nothing is customers describing, in their own words, what the shop does not stock.
  Minimised to match: only zero-result searches are recorded (a search that worked teaches
  nothing, and was verified to appear nowhere in the log), the term is capped at 100
  characters, nothing identifying goes with it, and it is a distinct message so it can be
  filtered and purged on its own schedule.
- **A guard against dead controls.** `e2e/privacy.spec.js` fails if any page renders a button
  with no click handler, or an action label with no control behind it. Four shipped at once,
  so a check is worth more than four fixes.

### Fixed

- **Graceful shutdown would have timed out and exited 1 after any deploy that had traffic.**
  Idle keep-alive connections were swept **once**, at the moment shutdown began. A request
  still in flight at that instant becomes idle a few milliseconds later, and nothing closed
  it — so `server.close()` never completed, the 10-second backstop fired, and the process
  exited `1`. To an orchestrator that is a failed shutdown on every rollout of a server
  anybody was actually using.
  The sweep now repeats until the server reports closed. Found by extracting the logic and
  writing a test for it: the single call is the obvious implementation and it is wrong for
  precisely the case that matters.

- **CI failed installing the Playwright browser.** `npx playwright install --with-deps
  chromium` switches to root and runs `apt-get` against the Ubuntu and Google Chrome
  mirrors — eight seconds of apt output, a non-zero exit, and the browser download never
  reached. That apt pass is the flakiest thing in the workflow and buys nothing on a GitHub
  runner, whose image already ships the shared libraries Chromium needs.
  It is now a **fallback rather than the default**: install the browser, check it actually
  launches, and only run `playwright install-deps` if it does not — failing for real on the
  second attempt. "The runner image already has the libraries" is a judgement about someone
  else's image, so it is checked rather than assumed.
  The launch check also earns its place on its own: without it a genuinely missing library
  surfaces as ~190 failing tests later in the job, which reads like the application broke.
  Verified by extracting the step exactly as YAML hands it to bash and running it — which
  caught a second bug in the fix itself: the check was being written to `/tmp`, and node
  resolves `require` from the script's own directory, so it could not find
  `@playwright/test` in `Frontend/node_modules`. That would have failed on Linux too.

- **CI's front-end Build failed with `Could not resolve './pages/Shop'`** after the PascalCase
  page rename. The rename happened on Windows, where `core.ignorecase` defaults to `true`:
  the files moved on disk and git carried on tracking `shop.jsx`, `about.jsx` and
  `contact.jsx`. Every local check passed — lint, 56 unit tests, the build, 385 browser
  checks — because on a case-insensitive filesystem there was nothing to notice. The Linux
  runner checked out the old names and the imports pointed at files that were not there.
  The renames are now recorded with `git mv` (two steps, since git treats the destination as
  already existing), and `scripts/check-filename-case.mjs` compares git's index against the
  filesystem exactly. It runs as the **first** CI step, before install, because it needs only
  the checkout — and because naming both spellings in two seconds beats a module-resolution
  error that reads like a broken import path. Verified by reproducing the fault and watching
  it fail.

- **A request from a disallowed CORS origin was reported as a server fault.** The allowlist
  callback threw a plain `Error`, which is not an `AppError`, so the error middleware treated
  it as unexpected: every such request produced a `500`, an `ERROR` log line and a full stack
  trace. A disallowed origin is a caller or configuration condition, and treating it as a
  server failure buries real 500s under noise from every bot that sends an `Origin` header —
  exactly the same shape as the malformed-body `500` fixed earlier.
  The callback now returns `false`, so the response carries no `Access-Control-Allow-Origin`
  and the browser refuses it, which is where CORS is actually enforced. **The protection is
  unchanged**, verified in a real browser: the response is still blocked, no product data
  reaches the page, and the visitor still sees an honest error. A single
  `WARN  CORS origin rejected` names the origin, and a smoke check asserts the status is not
  5xx.
  Found by running [incident-response.md](docs/runbooks/incident-response.md) as a tabletop
  exercise against an induced fault, per Doc B §18.

- **Four controls promised something they could not do** — the same defect class as the two
  forms, and just as invisible in a code review:
  - **`BUY NOW`**, the most prominent call to action on the site, was an inert `<button>`.
    It is now a `<Link>` to `/shop` — a link rather than a button because it navigates, so
    middle-click, ctrl-click and "open in new tab" have to work.
  - **`Explore More`** on the room carousel, likewise inert. Also a `<Link>` now.
  - **The navbar account and wishlist icons** carried `cursor-pointer` and a hover colour —
    the visual vocabulary of a control — while being bare SVGs: unreachable by keyboard and
    announced as unlabelled graphics. There are no accounts and no wishlist, so they are now
    honestly decorative and `aria-hidden`.
  - **`Share`, `Compare` and `Like`** were plain `<span>`s in the product hover overlays, one
    set even with `cursor-pointer`. Three verbs for three features that do not exist. Removed
    rather than disabled — "Share" as decoration means nothing.

- **The brand was spelled two ways and painted two golds.** `Funiro` in the footer heading,
  the copyright line and the `#FuniroFurniture` hashtag is now `Furniro` everywhere.
  `#B88A2B` (2 occurrences, the Hero) is gone, and so is `#a57924` — a hover shade derived
  from the wrong gold and used in 7 places alongside the right one. One gold, one hover.

- **The `Footer` was imported and rendered by all eight page components.** Eight copies to
  keep in step. It now renders once in `App.jsx`, outside the route error boundary so a route
  that fails to load still offers a way out of the page.
- **A processing register** (`PRIV-06`) — [docs/PROCESSING_REGISTER.md](docs/PROCESSING_REGISTER.md).
  Every processing activity the system performs, verified against the source rather than
  inferred from intent: request logs (no IP, no query string), rate limiting (IP as an
  in-memory counter key, never logged), client error reports (user-agent, never stored beside
  an IP), and the cart in `localStorage`.
  The "lawful basis" column is marked `NEEDS SIGN-OFF` throughout. Choosing a basis is a legal
  judgement about a specific business in a specific jurisdiction, and there is no identified
  controller, place of business or target market to judge against — so the register gives a
  lawyer a factual starting point instead of pretending to be the answer.
  Writing it corrected one claim of its own: the cart key is `furniro.cart.v1`, not
  `furniro.cart`. A register that is wrong once is never trusted again, so the storage claims
  are now asserted by browser tests rather than described.

- **Client error reporting** (`PLAT-04`) — `POST /api/client-errors`. A crash in a visitor's
  browser was invisible: the API answered 200 and the bundle threw afterwards, so nothing
  anywhere knew. The blank `/shop` page that prompted the whole e2e suite was this exact
  shape and was found by a person opening the page.
  Render crashes, unhandled rejections, window errors and failed chunk loads now reach the
  same structured log as everything else, with the same correlation id.
  It is the API's only unauthenticated write, so the input handling matters more than the
  feature: every field is read from an allowlist and truncated, the response is `204` with no
  body so nothing can be reflected at another visitor, `writeLimiter` applies because one log
  line per request is an amplifier, and reports are logged at `warn` — a visitor's browser
  extension throwing is not a server fault, and burying real 500s under extension noise is
  how alerting gets muted.
  The reporter never throws (it runs where the app is already broken), never reports a
  failure that happened inside itself, deduplicates by message so a render loop cannot flood,
  and caps distinct reports per page load. 17 unit tests cover those guarantees.
  It gets its own rate limit (`RATE_LIMIT_CLIENT_ERROR_MAX`, 60/hour) rather than reusing the
  write limit. That one allows five an hour, which is right for a contact form — a human
  filling in a form six times an hour is not a human — and wrong here: reports arrive without
  anyone choosing to send them, and the key is an IP, so behind a corporate NAT or mobile
  CGNAT one budget is shared by everyone on it. At five an hour, one broken page in an office
  silences the report for every colleague. Found by the smoke suite throttling itself.


- **Two forms collected personal data and threw it away.** The contact form had no submit
  handler, so pressing Submit triggered a native GET, reloaded the page and discarded the
  name, email and message. A customer writing about a problem watched the fields empty and
  had every reason to believe it had been sent; nobody was ever going to read it. The
  newsletter input did nothing at all — no request, no feedback.
  Both are now disabled with a visible explanation, pointing at the phone number and address
  that do reach someone. Making them work needs `POST /api/contact`, somewhere to store a
  message and something to deliver it — none of which exist. Soliciting an email address
  under a false premise is worse than not asking.

- **A latent PII leak in the contact form, introduced while fixing it and caught by a test.**
  Disabling the form meant adding `name` attributes, which is what makes a native GET
  serialise fields into the URL:
  `/contact?email=visitor%40example.com&message=…` — landing in browser history, in whatever
  access log the host keeps, and in the `Referer` header sent to third parties. Removing
  `disabled`, the single most likely future edit to that file, would have been enough to start
  leaking. The form now blocks native submission outright, so it cannot leak whatever state
  its fields are in. Confirmed by removing the guard and watching the test fail.

- **CI's front-end Build step failed with `ERR_MODULE_NOT_FOUND: dotenv`.** `generate-seo.mjs`
  imported the catalogue *service* to build the redirect map, and that reaches
  `repository.js` → `logger.js` → `config.js` → `dotenv`. The front-end CI job installs only
  the front end's dependencies at that point — the API's arrive later, for the e2e run — so
  the build could not resolve it. Lint and unit tests passed first, because nothing else in
  that job touches those files.
  The ranking now lives in `redirects.js`, pure and dependency-free for the same reason
  `publishGate.js` is, and both the API and the build import it. That keeps the single
  definition — a redirect map with its own copy of the ranking would eventually disagree with
  the API about where a discontinued product goes — without the build inheriting the API's
  runtime.
  Fixed by removing the dependency rather than by installing the API's packages earlier in
  CI: building the front end should not require the back end's runtime. A unit test now
  asserts both files import only relative paths and `node:` builtins, confirmed to fail when
  a bare import is added.

- **A malformed request body returned `500` instead of `400`.** `body-parser` rejects bad
  JSON with a 4xx `status` and a `type` like `entity.parse.failed`, but the error middleware
  trusted only `AppError`, so every malformed request was reported as a server fault and
  logged at `error` with a full stack. Latent until now — this is the API's first `POST`.
  It is wrong twice over: the mistake is the client's, and it poisons exactly the error
  signal `PLAT-04` exists to produce, since a scanner posting garbage would look like the API
  falling over. Now `400` (or `413` for an oversized body) with code `INVALID_BODY`, logged
  at `warn`, and the malformed input is never echoed back. The check is narrow on purpose: it
  trusts `status` only on errors carrying body-parser's `type` marker, so a library that sets
  `status = 400` on an internal failure is still a `500`.
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

## Known issues

Carried forward until fixed. Each is a real defect, not a missing feature.

**Audited 2026-09-09.** Entries that had been fixed were removed rather than left to rot — a
known-issues list that lists things that are not issues gets skimmed and then ignored. Each
removal was verified against the running app first: the Share/Compare/Like entry looked stale
because the controls sit in a hover overlay and a text probe missed them. They were real, and
are now fixed rather than dropped.

### Front end

- **Cart is guest-only and client-side.** No reservation (`CART-03`), no server-side
  persistence or retention (`CART-04`), and it does not follow a customer across devices
  (`CART-05`).
- **The contact and newsletter forms are disabled, not working.** They no longer discard what
  is typed into them, but there is still no way for a customer to send a message from the
  site. Needs `POST /api/contact`, somewhere to store a message and something to deliver it.
- **The brand gold fails WCAG AA for normal text.** `#B88E2F` is 3.02:1 on white — enough for
  large text, not for body text or button labels, on primary buttons across the whole site.
  An open design decision, capped so it cannot spread: see
  [ADR 0011](docs/decisions/0011-automated-accessibility-checks.md).
- **The blog lives at `/about`.** The nav says "About", the URL says `/about`, and the page's
  heading, breadcrumb and title all say "Blog". `npm run seo` reports it as two warnings.
  Fixing it means either routing the blog at `/blog` with a redirect, or writing About
  content — a product decision, not a defect repair.

### Back end

- **No cart, orders, auth or payments.** The API serves the catalogue and the blog, plus a
  client-error endpoint. See [docs/MODULES.md](docs/MODULES.md#build-order).
- **Signal delivery is still unverifiable on Windows.** The shutdown *logic* is now tested
  on any platform (`src/platform/shutdown.test.js`, 10 checks) and exercised against the real
  Express app. What cannot be tested here is the delivery itself: `Stop-Process` and
  `child.kill()` are hard terminates on Windows and never run a handler — confirmed by trying
  it, which killed the process in 10 ms with exit code `null` and no log line. It is Linux
  where this matters, and the first real `SIGTERM` will be in a container.
- **No alerting.** `PLAT-04` collects client and server errors into the structured log, but
  a log is a record, not a page. Nothing tells anyone an error happened.
- **No retention enforcement.** Doc B §11 sets 30 days hot / 12 months cold for logs.
  Nothing purges anything — `PLAT-05`, the job framework, does not exist. See
  [docs/PROCESSING_REGISTER.md](docs/PROCESSING_REGISTER.md).

### Repository

- **No deployment configuration** for either tier, and no host chosen. `dist/_redirects` is
  generated for a host that understands it; none is selected.
- **Whether `Backend/.env` ever reached git history is unverified.** Rotation is outstanding
  regardless — see [SECURITY.md](SECURITY.md#-current-exposure--act-on-this-first).
- **No privacy notice** (`PRIV-07`). Everything in the processing register is undisclosed to
  the people it concerns. Needs legal copy this project will not invent.

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
