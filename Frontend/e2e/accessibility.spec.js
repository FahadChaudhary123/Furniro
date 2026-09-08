import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

/**
 * Automated accessibility checks — `NFR-10`.
 *
 * Doc B §4 asks for the purchase path to be audited quarterly with assistive technology.
 * That is a human activity and this is not it: an automated scan catches roughly a third of
 * WCAG failures, and nothing here tells you whether the page is usable with a screen reader.
 * What it does is stop the third it can catch from regressing between audits, which is the
 * part a quarterly cadence is worst at.
 *
 * `axe-core` is a devDependency and never reaches a visitor's bundle. It is 3 MB unpacked,
 * which is a lot for this project's usual standard — but the alternative is hand-rolling
 * WCAG 2.1 rules, and a half-implemented accessibility checker is worse than none because
 * it reports clean.
 *
 * The scan found 83 failing nodes when it was first run. 75 were fixed: three unlabelled
 * carousel buttons announced as just "button", grey body text below 4.5:1, and five badge
 * and button fills too light for white text. The eight that remain are all the brand gold,
 * recorded below as an explicit exception because changing a brand colour is a design
 * decision, not a defect fix.
 */

/** The purchase path, plus the pages a visitor reaches from it. */
const PATHS = ['/', '/shop', '/shop/syltherine', '/cart', '/contact', '/about'];

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Known, accepted contrast failures — the brand gold `#B88E2F` and the `#B88A2B` variant
 * that CLAUDE.md records as a bug rather than a second brand colour.
 *
 * Both sit at about 3.0:1 on white. That passes AA for large text and fails it for normal
 * text, so the fix is either a darker gold (`#927125` reaches 4.55:1 on the same hue) or
 * restricting the gold to headings and large controls. Either is a design decision.
 *
 * Listed by colour pair rather than by count of nodes, so moving an existing gold button
 * does not fail the suite — but using the gold somewhere new does not slip through either,
 * because MAX_KNOWN_NODES caps how far it can spread.
 */
const KNOWN_CONTRAST_EXCEPTIONS = ['#b88e2f', '#b88a2b'];
const MAX_KNOWN_NODES = 8;

/** True when a violation node is one of the accepted brand-gold pairs. */
const isKnownBrandContrast = (violationId, node) => {
  if (violationId !== 'color-contrast') return false;
  const data = node.any?.[0]?.data;
  if (!data) return false;
  const pair = [data.fgColor, data.bgColor].map((c) => (c ?? '').toLowerCase());
  return KNOWN_CONTRAST_EXCEPTIONS.some((gold) => pair.includes(gold));
};

/** Readable one-line summary of a violation node, for a failure message worth reading. */
const describe = (violation, node) => {
  const data = node.any?.[0]?.data;
  const colours = data ? ` [${data.fgColor} on ${data.bgColor}, ${data.contrastRatio}:1]` : '';
  return `${violation.id} (${violation.impact})${colours}: ${node.html.replace(/\s+/g, ' ').slice(0, 100)}`;
};

async function scan(page, path) {
  // `networkidle`: the product grid arrives after first paint, and scanning before it
  // renders audits an empty page and reports it clean.
  await page.goto(path, { waitUntil: 'networkidle' });
  return new AxeBuilder({ page }).withTags(WCAG).analyze();
}

test.describe('WCAG 2.1 AA', () => {
  for (const path of PATHS) {
    test(`${path} has no unexpected violations`, async ({ page }) => {
      const results = await scan(page, path);

      const unexpected = [];
      for (const violation of results.violations) {
        for (const node of violation.nodes) {
          if (!isKnownBrandContrast(violation.id, node)) {
            unexpected.push(describe(violation, node));
          }
        }
      }

      expect(unexpected, `${path}:\n  ${unexpected.join('\n  ')}`).toEqual([]);
    });
  }

  test('the accepted brand-gold exceptions have not spread', async ({ page }) => {
    // The exception list is not a licence to add more gold-on-white text. If this fails,
    // either the new usage is large text and belongs in the design system, or the gold
    // needs darkening — it is not a signal to raise the cap.
    let known = 0;
    for (const path of PATHS) {
      const results = await scan(page, path);
      for (const violation of results.violations) {
        for (const node of violation.nodes) {
          if (isKnownBrandContrast(violation.id, node)) known += 1;
        }
      }
    }
    expect(known, 'brand-gold contrast failures have increased').toBeLessThanOrEqual(
      MAX_KNOWN_NODES,
    );
  });
});

test.describe('critical failures, specifically', () => {
  // Separated so a critical regression is unmistakable in the report rather than one line
  // among many. These are the ones that make a page unusable rather than merely awkward.
  for (const path of PATHS) {
    test(`${path} has no critical or serious violations outside the known exceptions`, async ({
      page,
    }) => {
      const results = await scan(page, path);
      const bad = results.violations
        .filter((v) => v.impact === 'critical' || v.impact === 'serious')
        .flatMap((v) => v.nodes.filter((n) => !isKnownBrandContrast(v.id, n)).map((n) => describe(v, n)));

      expect(bad, `${path}:\n  ${bad.join('\n  ')}`).toEqual([]);
    });
  }
});

test.describe('keyboard and structure', () => {
  test('every interactive control is reachable by keyboard', async ({ page }) => {
    await page.goto('/shop', { waitUntil: 'networkidle' });

    // A control that cannot be focused cannot be operated without a mouse. Buttons and
    // links are focusable by default; this catches a div that was made clickable instead.
    const unreachable = await page.$$eval(
      '[onclick], [role="button"], button, a[href]',
      (els) =>
        els
          .filter((el) => {
            if (el.tabIndex >= 0 || el.hasAttribute('disabled')) return false;
            // `aria-hidden="true"` with `tabindex="-1"` is the correct way to hide a
            // REDUNDANT control: the product cards wrap the image in a second link to the
            // same page, and exposing both makes a screen reader announce every product
            // twice. Removing it from the tab order is the fix, not the bug.
            return !el.closest('[aria-hidden="true"]');
          })
          .map((el) => `${el.tagName.toLowerCase()}: ${el.outerHTML.slice(0, 80)}`),
    );

    expect(unreachable, `not keyboard reachable:\n  ${unreachable.join('\n  ')}`).toEqual([]);
  });

  test('each page has exactly one h1', async ({ page }) => {
    // Zero leaves a screen-reader user with no page title in the heading outline; more than
    // one makes "jump to main heading" ambiguous.
    for (const path of PATHS) {
      await page.goto(path, { waitUntil: 'networkidle' });
      const count = await page.locator('h1').count();
      expect(count, `${path} has ${count} <h1> elements`).toBe(1);
    }
  });

  test('the carousel dots say which slide they select', async ({ page }) => {
    // These were three identical unlabelled buttons — announced as "button, button, button".
    await page.goto('/', { waitUntil: 'networkidle' });
    const dots = page.locator('button[aria-label^="Show "]');
    await expect(dots).not.toHaveCount(0);

    const labels = await dots.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(new Set(labels).size, 'dot labels must be distinct').toBe(labels.length);
    await expect(page.locator('button[aria-current="true"]')).toHaveCount(1);
  });
});
