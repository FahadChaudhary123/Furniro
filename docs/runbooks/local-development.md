# Runbook: local development

Setting up a working environment, and fixing it when it misbehaves.

> **Last executed as written:** 2026-09-08. Doing so found four defects, including that the
> documented setup did not work: the API binds to `PORT` from `.env` while the front end and
> the smoke test both assumed 3000. Doc B §18 asks for one runbook a month to be run by
> someone who did not write it — if they cannot follow it, the runbook is wrong.

---

## Setup

**Prerequisites:** Node `^20.19.0` or `>=22.12.0` — Vite 8 refuses to start below that.
Verified on Node 22.18.0, npm 11.10.0.

```bash
node -v    # must satisfy the range above
npm -v
```

### Front end

```bash
cd Frontend
npm install
npm run dev
```

**Verify:** the terminal prints a `Local:` line and the page loads. It is `5173` unless that
port is taken, in which case Vite says which one it chose — that is normal, not a failure.

Click through `/`, `/shop`, a product from the grid, `/about`, a blog post, `/cart` and
`/contact`. An unknown path such as `/nope` should show a 404 page, not a blank one.

**Start the API too.** The shop grid and the home-page product strip fetch from it. Without
it you get an error panel with a retry, not products — which is correct behaviour, not a
setup failure. Everything else on the page renders standalone.

### Back end

```bash
cd Backend
npm install
[ -f .env ] || cp .env.example .env    # then fill in real values
npm run dev
```

**The guard matters.** A bare `cp .env.example .env` overwrites a populated `.env` with the
empty template, destroying working credentials. It is written this way because that is what
this runbook did before it was executed.

**Verify:** the log prints `server listening` — check the `port` it reports. It comes from
`PORT` in `.env` and is **not** necessarily 3000. Then, in another shell:

```bash
npm run smoke             # 81 checks; all should pass
```

`npm run smoke` reads the same `.env`, so it follows the server wherever it binds — both
the port and the CORS allowlist. Start the API with an `ALLOWED_ORIGINS` that `.env` does
not have and the CORS check will fail: it is asserting the configuration it can see, not
the one that shell happens to hold.

**If you change `PORT`, set `VITE_API_URL` to match** in `Frontend/.env.local`, or the front
end will keep asking `http://localhost:3000/api` and show an error panel instead of products.
See [Products show an error](#products-show-could-not-reach-the-api).

It starts without Supabase credentials — you get a warning, `/health` still works, and
database access fails at the point of use rather than at boot.

Never commit `.env`. Confirm the ignore rule is working before you stage anything:

```bash
git check-ignore -v Backend/.env    # must print the matching rule
```

---

## Commands

| Command | In | Does |
|---|---|---|
| `npm run dev` | `Frontend/` | Dev server with HMR |
| `npm run build` | `Frontend/` | Production build to `dist/` |
| `npm run preview` | `Frontend/` | Serve the built `dist/` |
| `npm run lint` | `Frontend/` | ESLint over `**/*.{js,jsx}` |
| `npm run budgets` | `Frontend/` | Performance budgets against `dist/` |
| `npm run seo` | `Frontend/` | SEO health check; non-zero on a duplicate title or orphaned page |
| `npm test` | either | Unit tests (56 front end, 62 back end) |
| `npm run verify` | `Frontend/` | lint + unit + build + budgets + seo |
| `npm start` | `Backend/` | Run the API |
| `npm run dev` | `Backend/` | Run the API with nodemon reload |
| `npm run smoke` | `Backend/` | 81 checks against a running API |
| `npm run completeness` | `Backend/` | Catalogue data-quality report; non-zero if any product is blocked |
| `npm run latency` | `Backend/` | API latency benchmark; needs `RATE_LIMIT_MAX` above ~2400 |
| `npm run e2e` | `Frontend/` | 343 browser checks; starts both servers itself |

Run `npm run verify` and `npm run e2e` (front end) and `npm test` + `npm run completeness`
+ `npm run smoke` (back end) before opening a PR.

---

## Troubleshooting

### `browsers data (caniuse-lite) is N months old`

```bash
cd Frontend
npx update-browserslist-db@latest
```

**Then restart every running dev server.** The check runs once at process startup, so a
process started before the update keeps printing the warning for its whole lifetime, no
matter how many times you re-run the update. This is the single most common reason the fix
"does not work".

Verify it is genuinely resolved:

```bash
cd Frontend
node -e "const a=require('caniuse-lite/dist/unpacker/agents').agents;let l=0;for(const n in a){const d=a[n].release_date||{};for(const k in d)if(d[k]&&d[k]>l)l=d[k];}const p=new Date(l*1000),n=new Date();console.log('newest release in DB:',p.toISOString().slice(0,10),'| months old:',(n.getFullYear()-p.getFullYear())*12+(n.getMonth()-p.getMonth()));"
```

Under 6 months means no warning. Note the field is `release_date`, and it is on
`caniuse-lite/dist/unpacker/agents` — the top-level `caniuse-lite` export does not carry
it, so a check written against that path silently reports "clean" regardless of the data.

### Port 5173 already in use

Vite falls through to the next free port and prints which one it chose. If you want 5173
back, find the holder:

```bash
# Windows (PowerShell)
Get-NetTCPConnection -LocalPort 5173 -State Listen |
  ForEach-Object { Get-Process -Id $_.OwningProcess }

# macOS / Linux
lsof -i :5173
```

On Windows, killing the `npm` wrapper process does **not** kill the `vite` child. Stop the
`node ... vite.js` process itself, or the port stays held.

### Changes not appearing in the browser

1. Check the dev server terminal for a build error.
2. Hard refresh — Ctrl+Shift+R.
3. Clear the Vite cache and restart:

   ```bash
   cd Frontend
   rm -rf node_modules/.vite
   npm run dev
   ```

### Products show "Could not reach the API"

The front end could not reach the API. In development the error names the URL it tried —
compare it with the `port` the API logged at startup. **A mismatch here is the most common
cause, not an outage**, and it is exactly what happens with a `.env` that sets `PORT` to
anything other than 3000.

1. Is the API running? `cd Backend && npm run dev`.
2. **Do the ports agree?** The API uses `PORT` from `Backend/.env`; the front end uses
   `VITE_API_URL`, defaulting to `http://localhost:3000/api`. Set `VITE_API_URL` in
   `Frontend/.env.local` to match. **Restart Vite after changing it** — env values are
   inlined at startup, not read per request.
3. Is the front end's origin in `ALLOWED_ORIGINS`? A CORS rejection looks identical to an
   outage from the browser's side. The API logs `CORS origin rejected` with the origin it
   saw — check the API's output.
4. Quote the reference id shown under the error. It is the correlation id, and it appears
   on the matching server log line.

### `Supabase is not configured`

`SUPABASE_URL` or `SUPABASE_ANON_KEY` is missing from `Backend/.env`. The server starts
anyway and warns at boot; the error is thrown by the first code that needs the database.
Copy `.env.example` and fill it in.

If the values *are* set and you still see this, check that nothing reads `process.env`
before `src/platform/config.js` is imported — ES imports are hoisted, so ordering matters.

### `EADDRINUSE`

Another process holds the port. The server logs this and exits rather than hanging. Set
`PORT` in `Backend/.env`, or find the holder as described above for 5173.

### A clean reinstall

```bash
cd Frontend
rm -rf node_modules package-lock.json
npm install
```

Only do this deliberately: regenerating `package-lock.json` can pull newer transitive
versions, and `Frontend` pins a Vite beta through `overrides`. Check `npm run build` still
passes afterwards, and review the lockfile diff rather than committing it blind.
