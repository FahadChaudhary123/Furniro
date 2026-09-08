# AGENTS.md

Instructions for AI coding agents working in this repository.

**This file intentionally mirrors [CLAUDE.md](CLAUDE.md), which is the canonical source.**
`AGENTS.md` exists so that agents following the `AGENTS.md` convention find guidance at the
path they look for. Read [CLAUDE.md](CLAUDE.md) in full — it is short, and everything in it
applies.

When updating agent guidance, **edit `CLAUDE.md`** and leave this file as the pointer, so
the two cannot drift apart.

---

## The short version

- **What exists:** a running API (`platform`, `catalogue`, `content` modules) and a front
  end that fetches from it, plus a guest cart. **What does not:** a database, auth,
  checkout, payments, orders or inventory. Do not write code assuming any of those.
- **Never print, commit or expose a secret.** `Backend/.env` holds live credentials,
  including a `DATABASE_URL` containing the database password.
- **Never give a secret a `VITE_` prefix** — Vite inlines those into the public bundle.
- **Never store formatted price strings or use floats for money.** Integers in minor units.
- **Do not run `git init`, commit, or push** unless asked. The repo is uninitialised and
  `.env` holds live credentials.
- **Verify with `npm run verify` and `npm run e2e` in `Frontend/`, and `npm run smoke` in
  `Backend/`** before reporting done. A build that succeeds is not a page that renders — the
  end-to-end suite exists because lint, build and API tests were all green while `/shop`
  rendered blank.
- **Product data has exactly one home:** `Backend/src/modules/catalogue/data/products.json`.
  Never add a second copy. The cart stores `{slug, quantity}` and never a price.

Full rules, conventions, and the list of known traps: [CLAUDE.md](CLAUDE.md).
