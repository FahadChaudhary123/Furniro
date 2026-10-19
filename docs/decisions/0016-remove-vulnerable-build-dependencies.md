# 0016: Remove vulnerable build dependencies

Date: 2026-10-17
Status: Accepted

## Context

GitHub's `npm audit --audit-level=high` fails in the independent npm packages.
The `braces` advisory GHSA-vfj7-8cjw-p6xm affects every published version through
3.0.3, with no patched release. Tailwind 3 and nodemon bring it through their
file-watching/globbing dependencies. Other findings have compatible patches.

## Decision

Use the official Tailwind 4.3.3 migration in Frontend and Operator, with
`@tailwindcss/postcss`. Migrate renamed utility classes and keep the generated
border-default compatibility layer. Remove unused Tailwind JS configuration files
and Autoprefixer; Tailwind 4 supplies prefixing. Preserve Vite 8.0.0-beta.13.

Replace backend `nodemon index.js` with `node --watch index.js`; the existing Node
minimum supports native watch mode. Update Sharp to at least 0.35.5 and resolve
patched brace-expansion, source-map-js, ip-address and proxy-addr in the lockfiles.

Do not use `npm audit fix --force`, suppress advisories, exclude development
dependencies from the audit, or lower the CI severity gate. Commit manifests,
lockfiles and styling migration together so `npm ci` reproduces the fix.

## Consequences and verification

Tailwind 4 requires Safari 16.4+, Chrome 111+ and Firefox 128+. Older browsers are
outside the supported styling baseline. Desktop/mobile Chromium browser suites
exercise the migrated styles and accessibility; they do not prove Safari/Firefox
compatibility. The CSS budget remains enforced without increasing its limit.

Tailwind 4 limits hover utilities to devices that support hover. Product-card cart
actions are therefore explicitly visible and tappable on touch devices, with a tap-only
browser regression check. Featured-card actions use dark text and their own layout space
on touch screens so they remain readable without covering product details.

Validate clean `npm ci` and `npm audit --audit-level=high` in all three packages,
both UI builds/browser suites, backend tests/smoke and catalogue completeness.
Future advisories can still fail CI and must be reviewed when they appear.

## References

- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://tailwindcss.com/docs/upgrade-guide
