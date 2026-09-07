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

- **The back end does not exist.** `Backend/index.js` is empty; `controllers/`, `models/`,
  `routes/`, `middlewares/` and `utils/` are empty directories. The front end makes zero
  network calls. Do not write code assuming an API, database, cart, or logged-in user.
- **Never print, commit or expose a secret.** `Backend/.env` holds live credentials,
  including a `DATABASE_URL` containing the database password.
- **Never give a secret a `VITE_` prefix** — Vite inlines those into the public bundle.
- **Never store formatted price strings or use floats for money.** Integers in minor units.
- **Do not run `git init`, commit, or push** unless asked. The repo is uninitialised and
  `.env` holds live credentials.
- **Verify with `npm run lint` and `npm run build` in `Frontend/`** before reporting done.
  There are no tests.
- **Read [DATA_MODEL.md](DATA_MODEL.md) before touching product data** — two incompatible
  shapes exist in the codebase.

Full rules, conventions, and the list of known traps: [CLAUDE.md](CLAUDE.md).
