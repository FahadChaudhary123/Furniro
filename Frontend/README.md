# Furniro — front end

React 19 + Vite 8 SPA. This directory is the storefront; the API tier lives in
[`../Backend/`](../Backend/).

**Documentation lives at the repository root:**

| | |
|---|---|
| Setup, scripts, project status | [../README.md](../README.md) |
| Structure and design decisions | [../ARCHITECTURE.md](../ARCHITECTURE.md) |
| Product/blog/category shapes | [../DATA_MODEL.md](../DATA_MODEL.md) |
| Conventions and PR process | [../CONTRIBUTING.md](../CONTRIBUTING.md) |
| Troubleshooting | [../docs/runbooks/local-development.md](../docs/runbooks/local-development.md) |

## Quick start

```bash
npm install
npm run dev
```

Requires Node `^20.19.0` or `>=22.12.0` — Vite 8 will not start below that.

| Script | Does |
|---|---|
| `npm run dev` | Dev server with HMR on port 5173 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the built `dist/` |
| `npm run lint` | ESLint over `**/*.{js,jsx}` |

Run `lint` and `build` before opening a PR. There are no tests yet.

> This file replaced the default Vite template README, which described a starter template
> rather than this project.
