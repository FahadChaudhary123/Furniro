# 0011 — Automated accessibility checks, with a recorded brand exception

**Date** 2026-09-08 · **Status** Accepted

## Context

`NFR-10` (Doc B §4) asks for the purchase path to be audited quarterly with assistive
technology. That is a human activity, it has never happened, and nothing in a CI pipeline
can substitute for it.

But a quarterly cadence is worst at exactly the thing automation is best at: catching a
regression the day it lands rather than up to three months later. The project already had
some hand-written accessibility assertions — alt text on every image, an accessible name on
every link — and each one was written after someone noticed the gap.

The first full scan found **83 failing nodes** across six pages. That is not a set of
problems anyone was going to find by eye.

## Decision

Run `axe-core` against the purchase path in the existing Playwright suite, at both the
desktop and mobile viewports, failing on any WCAG 2.1 A/AA violation.

Fix everything that is a defect. Record the brand-gold contrast failures as an explicit,
capped exception rather than fixing them unilaterally or suppressing them silently.

## Alternatives

**Hand-rolled WCAG rules.** Rejected. `axe-core` is 3 MB unpacked, which is well outside
this project's usual standard for a dependency — four have been removed for less. But it is
a `devDependency` that never reaches a visitor's bundle, and the alternative is a
half-implemented accessibility checker, which is worse than none because it reports clean.
The rule stays "measure before assuming a dependency earns its weight"; this one was
measured and it does.

**Lighthouse CI.** Broader, but its accessibility score is an aggregate. A score that moves
from 94 to 92 does not say what broke, and a threshold is not a gate.

**Desktop viewport only.** Rejected once the data was in. The mobile hamburger button had no
accessible name — a `critical` failure on the one control that reaches every other page on
mobile — and it is `md:hidden`, so a desktop-only scan does not see it at all. Six of the
twelve initial mobile failures were invisible on desktop.

**Suppressing the brand-gold failures with an axe rule exclusion.** Rejected. That hides the
problem from the next person to look. The exception is a named constant with a comment
explaining the trade-off and a cap on how far it can spread.

## Consequences

75 of 83 failing nodes were fixed:

- three unlabelled carousel dots, announced as "button, button, button"
- the mobile hamburger, announced as "button"
- body text at `text-gray-400` (2.53:1 on white) and `text-gray-500` on the grey card
  background (4.43:1, against a 4.5:1 requirement)
- five badge and button fills too light for white text — `red-400`, `teal-400`,
  `emerald-500`, `red-500`, `yellow-600`
- a second `<h1>` on **every** page: the footer brand mark. "Jump to main heading" landed in
  the footer half the time.

The remaining eight are all the brand gold `#B88E2F` at **3.02:1 on white**. That passes AA
for large text (3.0:1) and fails it for normal text (4.5:1). It is on primary buttons across
the whole site.

**This is a design decision and it is still open.** Two options:

- darken the gold — `#927125` reaches 4.55:1 on the same hue
- restrict the gold to headings and large controls, and use a darker tone for normal text

Until that is decided, `MAX_KNOWN_NODES` in `Frontend/e2e/accessibility.spec.js` caps the
count at 8. Using the gold somewhere new fails the suite. **Raising the cap is not the
remedy** — it is the signal that the decision can no longer be deferred.

## What this does not do

An automated scan catches roughly a third of WCAG failures. Nothing here says whether the
site is usable with a screen reader, whether focus order makes sense, whether error messages
are announced, or whether the checkout is completable without a mouse. `NFR-10` stays
**partial** and the quarterly audit it asks for still has to happen.
