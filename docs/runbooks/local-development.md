# Runbook: local development

Setting up a working environment, and fixing it when it misbehaves.

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

**Verify:** the terminal prints a `Local: http://localhost:5173/` line, and the page loads
with the navbar, hero and product sections. Navigate to `/shop`, `/about` and `/contact` —
all four routes should render.

Known and expected: **every product image on `/shop` is broken.** That is
[a real defect](../../CHANGELOG.md#known-issues), not a setup problem.

### Back end

**Does not start.** `index.js` is empty and there are no `start` or `dev` scripts. See
[README.md](../../README.md#wiring-up-the-back-end) for the three blockers.

If you are the one wiring it up:

```bash
cd Backend
cp .env.example .env      # then fill in real values
npm install
```

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

Run `lint` and `build` before opening a PR. There are no tests.

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

### `SyntaxError: Cannot use import statement outside a module`

From `Backend/`. `config/supabase.js` uses ESM syntax while `package.json` has no
`"type": "module"`. Add it. This is a known blocker, not a new breakage.

### Supabase client has `undefined` credentials

Nothing calls `dotenv.config()`. Whichever module is the entry point must load dotenv
**before** importing the Supabase client — module imports are hoisted and evaluated first,
so a `dotenv.config()` written below an `import` line runs too late.

### A clean reinstall

```bash
cd Frontend
rm -rf node_modules package-lock.json
npm install
```

Only do this deliberately: regenerating `package-lock.json` can pull newer transitive
versions, and `Frontend` pins a Vite beta through `overrides`. Check `npm run build` still
passes afterwards, and review the lockfile diff rather than committing it blind.
