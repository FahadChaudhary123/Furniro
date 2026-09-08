# 0008 — No animation library

**Date** 2026-09-08 · **Status** Accepted

## Context

Two animation libraries were installed for one effect. GSAP was imported only by a demo
component nothing imported. Framer Motion drove a single fade-and-rise wrapping the whole
home page.

Measured by building with and without: **Framer Motion cost 38.5 kB gzipped — 31% of the
JavaScript bundle.**

## Decision

Remove both. The reveal is a `@keyframes` rule in `index.css`.

## Alternatives

**Keep Framer Motion for future work.** Rejected on the measurement. 38.5 kB for one fade is
poor value on a storefront where Doc B §12 makes weight a CI gate, and re-adding it later is
one `npm install`.

**Keep GSAP instead.** Rejected — it was already tree-shaken out of the bundle, so it cost
nothing to ship and 6.4 MB to install, and nothing used it.

**Replace with an IntersectionObserver.** Unnecessary. The wrapper spanned the page from the
top, so it was in view immediately: `whileInView` was really a load animation, and CSS does
load animations for free.

## Consequences

- The CSS version honours `prefers-reduced-motion`, which the Framer configuration did not.
  An accessibility improvement arrived as a side effect of removing a dependency.
- Front-end dependencies dropped from eight to four.
- This is a measured decision, not a principle. Timeline sequencing, gesture-driven motion or
  shared-element transitions would justify Framer Motion again — and it remains the better
  fit for React than GSAP.
