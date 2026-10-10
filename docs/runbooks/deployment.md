# Runbook: deployment

🔴 **Nothing is deployed.** Render is the selected host for the static storefront and Node
API; [render.yaml](../../render.yaml) prepares both services. CI **is** running
(`.github/workflows/ci.yml`) — lint, build, budgets, end-to-end, API smoke, dependency
audit and secret scan. This is the procedure to follow once there is a host, and the set of
decisions to make first.

---

## Prerequisites

- [x] A git repository, with `main` as the default branch — done, CI is running
- [ ] A Render account connected to this repository
- [ ] Environment variables configured in the host — **not** committed
- [ ] Database password reset and unused legacy `anon` key retired after checking for
      other consumers; see [secret-rotation.md](secret-rotation.md)
- [ ] If Supabase tables are introduced, enable row-level security on every table
      before exposing the anon key ([why](../../SECURITY.md#2-know-what-the-anon-key-is))

---

## Front end

### Render Blueprint setup

Create a Blueprint from the repository's `render.yaml` after the credential review below.
The file defines `furniro-api` and `furniro-storefront`, deploys only when CI checks pass,
and rewrites unknown static paths to `/index.html`. It pins Node 22 for both builds and
does not provision a database.

At initial Blueprint creation, Render prompts for these values:

| Service | Variable | Value |
|---|---|---|
| API | `ALLOWED_ORIGINS` | Exact storefront origin, such as `https://<storefront>.onrender.com`, with no path |
| Storefront | `VITE_API_URL` | Exact public API base, such as `https://<api>.onrender.com/api` |
| Storefront | `VITE_SITE_ORIGIN` | Exact canonical storefront origin, with no trailing slash |

These URLs are public configuration, never credentials. Confirm the assigned Render URLs
before the first storefront build; a name collision may change the subdomain. The Render
build now runs `npm run deploy:check` and rejects missing, local, placeholder or malformed
public URLs. Confirm the assigned service URLs and correct them in the Render Dashboard
before rebuilding the storefront. Render prompts for `sync: false` variables only on
initial creation; later changes must be made in each service's environment settings.
Changing `VITE_API_URL` or `VITE_SITE_ORIGIN` requires a new storefront build. Check that
`dist/sitemap.xml`, `dist/robots.txt`, and canonical URLs use the real storefront origin.
Do not put `Backend/.env` or Supabase credentials into either service: the current JSON
repositories do not use them.

The generated `dist/_redirects` file targets Netlify/Cloudflare Pages and is not a Render
route configuration. Render's SPA rewrite is configured in `render.yaml`; discontinued
product redirects currently fall back to client-side navigation there. No product is
discontinued today. Before marking one discontinued, add the corresponding Render `redirect`
rule before the SPA rewrite. For example, use `type: redirect`, `source: /shop/old-slug`
and `destination: /shop/live-slug` under the storefront's `routes:` block. The front-end
build now runs `npm run redirects:check` against the canonical catalogue and fails if a
required rule is missing, stale or after the catch-all rewrite. It cannot confirm what
Render actually serves: after deployment, request the old product URL without following
redirects and verify `301` and its `Location` header. Render preserves Dashboard routing
rules omitted from a Blueprint, so also review old Dashboard rules when removing a
redirect. The generated `_redirects` file alone does not configure Render.

The front end is a static bundle. `npm run build` produces `Frontend/dist/`; anything that
serves files can host it.

### One setting that is not optional

The app uses `BrowserRouter`, which relies on the History API. **The host must rewrite all
unknown paths to `/index.html`.** Without it, a visitor who reloads on `/shop` — or opens a
shared link to it — gets a 404 from the host, because no `shop` file exists on disk. The
front end works perfectly in dev and breaks on first refresh in production, which is why
this is worth checking before the first deploy rather than after.

| Host | Setting |
|---|---|
| Vercel | Automatic for SPAs, or a `rewrites` entry in `vercel.json` |
| Netlify | `/* /index.html 200` in `_redirects` |
| Nginx | `try_files $uri $uri/ /index.html;` |
| Cloudflare Pages | Automatic with a `_redirects` file |
| Render | `/*` rewrite to `/index.html` in `render.yaml` |

### Procedure

1. **Confirm you are deploying what you think you are.**

   ```bash
   git status          # clean
   git log --oneline -1
   ```

2. **Build locally first.** A build that fails in CI after a merge is a worse discovery.

   ```bash
   cd Frontend
   npm ci              # not `npm install` — respects the lockfile exactly
   npm run verify      # lint + unit tests + build + budgets + SEO check
   ```

   **Verify:** `dist/index.html` and `dist/assets/` exist, all budgets report `ok`, and the
   build printed no browserslist warning.

3. **Smoke-test the built output**, not just the dev server.

   ```bash
   npm run preview
   ```

   Load `/`, `/shop`, `/shop/syltherine`, `/cart`, `/about`, `/contact` and a blog post.
   Then **reload the page while on `/shop`** — this
   is the check that catches a missing SPA rewrite.

4. **Set environment variables in the host.** Only `VITE_`-prefixed variables reach the
   front end, and **every one of them is public** — inlined into the bundle as a string
   literal. Never put a secret behind that prefix.

5. **Deploy**, per your host's mechanism.

6. **Verify in production:** core storefront routes, a hard refresh on a non-root route, browser
   console free of errors, and images loading.

---

## Back end

The back end serves the catalogue, blog and client-error endpoint as well as health
checks. The storefront depends on it for products, posts and cart line details; deploy
and verify the API before directing the storefront to it.

Build and run: `npm ci && npm start` in `Backend/`. Node `^20.19.0 || >=22.12.0`.

At deploy time:

- Render sets `PORT`; set `ALLOWED_ORIGINS` in its environment configuration. The current
  JSON repositories do not need Supabase credentials; do not copy unused live secrets to
  the host. Never put secrets in the repository.
- `ALLOWED_ORIGINS` must list the production front-end origin. **`cors()` with no arguments
  reflects any origin** and must never reach production.
- Production startup now rejects an unset, local, placeholder or malformed
  `ALLOWED_ORIGINS` value. Use exact HTTPS origins without paths or trailing slashes.
- Serve over HTTPS only.
- Point the platform's **liveness** probe at `GET /health` and its **readiness** probe at
  `GET /health/ready`. Do not point liveness at readiness: a liveness probe that checks the
  database will restart a healthy server during a database blip, turning a degradation into
  an outage.
- Render supplies `RENDER_GIT_COMMIT`; the API uses it as the `/health` build SHA unless
  `GIT_SHA` is explicitly set. Set `APP_VERSION` when release automation is configured.
  `/health` reports them, which is how
  Doc B §2 keeps "what is actually running" from being guesswork — and how a rollback is
  confirmed to have taken effect.
- Verify after deploy with `npm run smoke:deploy` from `Backend/`, setting
  `API_ORIGIN` and `STOREFRONT_ORIGIN` to the exact public HTTPS origins. This read-only
  check covers health, build identity, readiness, a published product, CORS, a hard
  request to `/shop`, storefront security headers and the entry script's cache policy.
  The local `npm run smoke` suite sends test errors and malformed requests, so use
  `smoke:deploy` for the live site.

---

## Cache policy

| Surface | Current policy | Remaining host work |
|---|---|---|
| API and health | `Cache-Control: no-store` on every response, including errors, so catalogue amounts and future customer data are not retained by intermediaries | Verify the header through Render with `npm run smoke:deploy` |
| Storefront HTML | `render.yaml` sets `Cache-Control: no-cache` on the known app routes; the browser must revalidate the shell | Verify through Render after deployment, including a hard `/shop` request |
| Fingerprinted assets | Vite emits content-hashed filenames; `render.yaml` sets one-year immutable caching under `/assets/*` | Verify through Render with `npm run smoke:deploy` |

Render serves static sites through its CDN and [invalidates its cache after a successful
deploy](https://render.com/docs/static-sites). `PLAT-10` remains open until this is deployed,
verified and tied to the catalogue publish process. The current JSON catalogue is served
fresh on each API request.

### Storefront security headers

`render.yaml` applies CSP, `nosniff`, frame denial, no-referrer and HSTS to all static
responses. The CSP allows scripts and images from the storefront, inline styles used by
the current components, and HTTPS API connections. Once the API's public origin is known,
restrict `connect-src` to that origin and rerun the browser suite. The browser suite tests
the proposed policy on `/shop` locally; `npm run smoke:deploy` checks the actual `/shop`
response headers after Render is deployed. Neither local test establishes that Render has
applied the Blueprint until the live smoke check passes.

## Bundle size

Enforced, not advisory. `npm run budgets` runs in CI as a blocking gate (Doc B §12) and
fails the build on regression.

Current local production build (`npm run budgets`, 2026-10-06):

| Metric | Value | Budget |
|---|---|---|
| Total assets, one visitor | 1.61 MB | 1.90 MB |
| Largest single asset | 264.6 kB (JS bundle) | 300.0 kB |
| JS gzipped | 97.2 kB | 115.0 kB |
| CSS gzipped | 4.7 kB | 25.0 kB |
| Third-party scripts | 0 | 0 |

The budget counts each image **once**, at its largest variant: `<picture>` offers AVIF,
WebP and JPEG but a browser fetches one, so summing the directory would count alternatives
as simultaneous downloads.

Remaining work, in order of payoff:

- **Higher-resolution product photography.** Seven of the eight product images are 285px
  wide against a 600px detail slot — the detail page shows them at roughly a quarter of the
  resolution it asks for, and the originals are 285px too. This is the largest remaining
  image problem and no build step can fix it; it needs better source files.
  `npm run audit:images` lists them.
- **Deploy and verify the Render CDN policy** above; the Blueprint defines the rules but no
  live host has served them yet.

Two former entries here are done or dropped:

- ~~**AVIF**~~ — landed 2026-09-10, 42.7% smaller than WebP, emitted only where it wins.
- ~~**`srcset`**~~ — measured and dropped. The claim that the featured strip "over-downloads
  by roughly 3x" predated per-image display-width sizing; the saving actually available is
  4 kB across one image, against a derivative set per image and a `sizes` attribute per slot.
  See [ADR 0009](../decisions/0009-size-images-before-format.md).

If a budget legitimately needs raising, change it in `Frontend/scripts/check-budgets.mjs`
in the same commit, with the reason in the commit message. A budget that drifts upward
silently is not a gate.

## After deploying

- [ ] Core storefront routes load, including a product and blog post
- [ ] Hard refresh on `/shop` works (SPA rewrite confirmed)
- [ ] No console errors
- [ ] Images load
- [ ] Mobile layout and navbar drawer work
- [ ] `npm run smoke:deploy` passes against the public API and storefront origins
- [ ] Note the release in [CHANGELOG.md](../../CHANGELOG.md)

If something is wrong: [rollback.md](rollback.md). Roll back first, diagnose after — a
production fault is not the place to debug forward.
