# Runbook: deployment

🔴 **Nothing is deployed and no host has been chosen.** There is no `vercel.json`, no
Dockerfile, and no environment configuration for a host. CI **is** running
(`.github/workflows/ci.yml`) — lint, build, budgets, end-to-end, API smoke, dependency
audit and secret scan. This is the procedure to follow once there is a host, and the set of
decisions to make first.

---

## Prerequisites, none of which exist yet

- [x] A git repository, with `main` as the default branch — done, CI is running
- [ ] A hosting account for the front end (static)
- [ ] A hosting account for the back end (Node), once it has code
- [ ] Environment variables configured in the host — **not** committed
- [ ] `SUPABASE_ANON_KEY` and `DATABASE_URL` rotated; the current values must be treated as
      compromised, see [secret-rotation.md](secret-rotation.md)
- [ ] Row-level security enabled on every Supabase table
      ([why](../../SECURITY.md#2-know-what-the-anon-key-is))

---

## Front end

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
   npm run verify      # lint + build + performance budgets, the same gates CI runs
   ```

   **Verify:** `dist/index.html` and `dist/assets/` exist, all budgets report `ok`, and the
   build printed no browserslist warning.

3. **Smoke-test the built output**, not just the dev server.

   ```bash
   npm run preview
   ```

   Load `/`, `/shop`, `/about`, `/contact`. Then **reload the page while on `/shop`** — this
   is the check that catches a missing SPA rewrite.

4. **Set environment variables in the host.** Only `VITE_`-prefixed variables reach the
   front end, and **every one of them is public** — inlined into the bundle as a string
   literal. Never put a secret behind that prefix.

5. **Deploy**, per your host's mechanism.

6. **Verify in production:** all four routes, a hard refresh on a non-root route, browser
   console free of errors, and images loading.

---

## Back end

The back end now runs and can be deployed, though it serves only `/health` and
`/health/ready` — no domain endpoints are mounted yet. Deploying it early is still worth it:
it proves the pipeline, the environment configuration and the health probe before anything
depends on them.

Build and run: `npm ci && npm start` in `Backend/`. Node `^20.19.0 || >=22.12.0`.

At deploy time:

- Set `PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DATABASE_URL` and `ALLOWED_ORIGINS` in
  the host's environment configuration. Never in the repository.
- `ALLOWED_ORIGINS` must list the production front-end origin. **`cors()` with no arguments
  reflects any origin** and must never reach production.
- Serve over HTTPS only.
- Point the platform's **liveness** probe at `GET /health` and its **readiness** probe at
  `GET /health/ready`. Do not point liveness at readiness: a liveness probe that checks the
  database will restart a healthy server during a database blip, turning a degradation into
  an outage.
- Inject `GIT_SHA` and `APP_VERSION` at build time. `/health` reports them, which is how
  Doc B §2 keeps "what is actually running" from being guesswork — and how a rollback is
  confirmed to have taken effect.
- Verify after deploy with `npm run smoke` against the deployed URL:
  `BASE_URL=https://api.example npm run smoke`.

---

## Bundle size

Enforced, not advisory. `npm run budgets` runs in CI as a blocking gate (Doc B §12) and
fails the build on regression.

Current, from a production build:

| Metric | Value | Budget |
|---|---|---|
| Total assets, one visitor | 1.60 MB | 1.9 MB |
| Of which images (JPEG path) | 1.26 MB | — |
| Of which images (WebP path) | 0.97 MB | — |
| Largest single asset | 266 kB (JS bundle) | 300 kB |
| JS gzipped | 102 kB | 115 kB |

The budget counts each image **once**, at its larger variant: `<picture>` ships both a JPEG
and a WebP but a browser fetches one, so summing the directory would count both and make a
modern format look like a regression.

Remaining work, in order of payoff:

- **Higher-resolution product photography.** Seven of the eight product images are 285px
  wide against a 600px detail slot — the detail page shows them at roughly a quarter of the
  resolution it asks for, and the originals are 285px too. This is the largest remaining
  image problem and no build step can fix it; it needs better source files.
  `npm run audit:images` lists them.
- **A CDN**, once there is a host — Doc B §12 wants a documented per-surface cache strategy.

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

- [ ] All four routes load
- [ ] Hard refresh on `/shop` works (SPA rewrite confirmed)
- [ ] No console errors
- [ ] Images load
- [ ] Mobile layout and navbar drawer work
- [ ] Note the release in [CHANGELOG.md](../../CHANGELOG.md)

If something is wrong: [rollback.md](rollback.md). Roll back first, diagnose after — a
production fault is not the place to debug forward.
