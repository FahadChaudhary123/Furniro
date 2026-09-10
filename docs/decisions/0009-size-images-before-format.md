# 0009 — Size images to their box before changing format

**Date** 2026-09-08 · **Status** Accepted

## Context

Doc B §15 requires modern formats served, so WebP was the obvious next step. Generating it
first and measuring showed **23%** off image weight — real, but less than expected.

Checking why led to the actual problem: images were sized by a blanket 1600px cap that
ignored how each one is used. `bedroom-3.jpg` shipped at 1600px into a **384px carousel
slot** — 4.2× oversized. Six files held **1.1 MB of waste**.

## Decision

Resize each image to twice the box it renders into (the retina allowance), using measured
display widths in `scripts/image-display-widths.mjs`. Then add WebP with a JPEG fallback via
a `<picture>` component.

Order matters: **2.18 MB → 1.26 MB from sizing, then → 0.97 MB from format.** Sizing was
worth roughly twice the format change.

## Alternatives

**WebP alone.** Would have shipped correctly-encoded oversized files. A `<picture>` wrapped
around a 4× image is still a 4× image.

**A blanket smaller cap.** Rejected: it blurs the full-bleed hero to fix a carousel
thumbnail. Different images have genuinely different requirements.

**`vite-imagetools` or similar.** Rejected — another build dependency, and it does not remove
the need for `<picture>`, since a static host cannot content-negotiate.

**AVIF as well.** Deferred: more encode time for a further step down, worth revisiting when
images matter more than they do at 0.97 MB.

## Consequences

- Display widths are now load-bearing configuration. A layout change that widens a slot
  ships a blurry image; one that narrows it ships waste. An end-to-end test asserts no image
  exceeds 4× its rendered box.
- The performance budget had to change with it. Shipping two formats doubles the directory,
  so the budget now counts each image **once at its larger variant** — bytes one visitor
  downloads, not bytes on disk. The old metric reported this improvement as a 60% regression.
- **`srcset` was on the backlog for this and has been measured and dropped** (2026-09-10).
  The reasoning above — one file must satisfy its largest slot, so smaller slots
  over-download — is sound, but this codebase sizes each file to its own display box × 2, and
  the waste that remains is 4 kB across one image on the home and detail pages combined.
  `srcset` means a derivative set per image, a `sizes` attribute per slot and a longer build,
  for that. Not worth it here; revisit if a layout appears where one file serves slots an
  order of magnitude apart.

- **Measuring it found the opposite problem.** Seven of the eight product source images are
  **285px wide against a 600px detail slot** — about a quarter of the resolution that view
  asks for — and the originals are 285px too, so they were never larger. No build step can
  fix that: `withoutEnlargement` means the optimiser will not invent pixels, and it should
  not. `npm run audit:images` now reports undersized files alongside oversized ones, because
  the oversized ones waste bytes and still look right while these look soft and cost nothing,
  which is why nobody had noticed.
