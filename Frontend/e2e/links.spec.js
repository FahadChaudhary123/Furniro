import { test, expect } from '@playwright/test';

/**
 * Broken-link and link-quality checks — `CONT-03`.
 *
 * Doc B §4 asks for broken-link and redirect-chain reporting. On a live site that is a
 * crawler plus traffic logs; before there is either, the checkable part is that every link
 * the app renders actually resolves.
 *
 * This has to run in a browser. The links live in React components and only exist once the
 * app has rendered — parsing `dist/index.html` finds one `<div id="root">` and no anchors at
 * all, so a static link checker would report a clean site while every link on it was broken.
 *
 * "Resolves" means more than HTTP 200: an SPA answers 200 for every path, including
 * `/shopp` and `/shop/does-not-exist`. A link is broken here if it lands on the 404 page,
 * which is what a visitor would actually experience.
 */

/** Every page a link can be found on. Dynamic routes get one representative each. */
const CRAWL = [
  '/',
  '/shop',
  '/about',
  '/contact',
  '/cart',
  '/shop/syltherine',
  '/blog/going-all-in-with-millennial-design',
];

/** The title baked into index.html. Seeing it means React never rendered. */
const STATIC_TITLE = 'Furniro — Furniture for modern living';

/** Collect every anchor on the current page, with the accessible name a screen reader gets. */
const collectLinks = (page) =>
  page.$$eval('a[href]', (anchors) =>
    anchors.map((a) => ({
      href: a.getAttribute('href'),
      // Mirrors the accessible-name calculation closely enough to catch an unlabelled link:
      // visible text, then aria-label, then the alt text of a contained image.
      name:
        (a.textContent || '').trim() ||
        a.getAttribute('aria-label') ||
        a.querySelector('img')?.getAttribute('alt') ||
        '',
      target: a.getAttribute('target'),
      rel: a.getAttribute('rel'),
    })),
  );

/**
 * Gather every link INSTANCE on the site, so each test does not re-crawl it.
 *
 * Every instance, not one row per href. Deduplicating by href hides exactly the bug this is
 * looking for: an unlabelled icon link to `/contact` is invisible if a labelled `/contact`
 * link elsewhere claimed the row first. Callers dedupe when they want to.
 */
async function crawl(page) {
  const instances = [];
  for (const path of CRAWL) {
    // `networkidle`, not the default `load`: product and post grids are fetched after the
    // first paint, so a crawl that does not wait for them finds a page with no product
    // links on it and reports a clean site.
    await page.goto(path, { waitUntil: 'networkidle' });
    for (const link of await collectLinks(page)) instances.push({ ...link, foundOn: path });
  }
  return instances;
}

/**
 * Follow a link and report the page a visitor actually lands on.
 *
 * Waiting for the TITLE, not for the network. React sets the title in an effect that runs
 * after `goto` resolves, so reading it immediately returns `STATIC_TITLE` — which never
 * matches /not found/, so every broken link would pass. That bug was in this file first.
 *
 * `networkidle` also fixed it and was the first thing tried here, but it waits for every
 * product image on a full grid to finish decoding; `/shop?category=living-room` exceeded the
 * 30s timeout under load. The title is the only thing this function returns, so waiting for
 * anything more is waiting for the wrong signal.
 */
async function visit(page, href) {
  await page.goto(href);
  await expect.poll(() => page.title(), { timeout: 15_000 }).not.toBe(STATIC_TITLE);
  return page.title();
}

const unique = (list) => [...new Set(list)];

test.describe('internal links', () => {
  test('every internal link resolves to a real page', async ({ page }) => {
    const instances = await crawl(page);

    const internal = new Map();
    for (const link of instances) {
      if (!link.href.startsWith('/') || link.href.startsWith('//')) continue;
      if (!internal.has(link.href)) internal.set(link.href, { name: link.name, foundOn: [] });
      internal.get(link.href).foundOn.push(link.foundOn);
    }
    expect(internal.size, 'the crawl found no internal links at all').toBeGreaterThan(10);

    const broken = [];
    for (const [href, info] of internal) {
      // The 404 page is the signal. A status check would pass for every path an SPA serves.
      const title = await visit(page, href);
      expect(title, `${href} did not render — every result here is meaningless`).not.toBe(
        STATIC_TITLE,
      );
      if (/not found/i.test(title)) {
        broken.push(`${href} ("${info.name}", linked from ${unique(info.foundOn).join(', ')})`);
      }
    }

    expect(broken, `broken links:\n  ${broken.join('\n  ')}`).toEqual([]);
  });

  test('no link points at a product the publish gate blocks', async ({ page, request }) => {
    // A card linking to a product the API refuses to serve is the exact 404-on-an-indexed-URL
    // failure Doc B §15 warns about, and it appears the moment catalogue data goes bad.
    const instances = await crawl(page);
    const productSlugs = unique(
      instances
        .map((l) => l.href)
        .filter((href) => href.startsWith('/shop/'))
        .map((href) => href.slice('/shop/'.length)),
    );

    expect(productSlugs.length, 'no product links found — did the grid render?').toBeGreaterThan(0);

    const missing = [];
    for (const slug of productSlugs) {
      const response = await request.get(`/api/products/${slug}`);
      if (!response.ok()) missing.push(`${slug} (API returned ${response.status()})`);
    }
    expect(missing, `linked but unavailable: ${missing.join(', ')}`).toEqual([]);
  });

  test('every link has an accessible name', async ({ page }) => {
    // An unnamed link is announced as "link" by a screen reader, and search engines get no
    // anchor text from it. Icon links need aria-label; image links need alt text.
    const instances = await crawl(page);
    const unnamed = unique(
      instances.filter((l) => !l.name).map((l) => `${l.href} (on ${l.foundOn})`),
    );

    expect(unnamed, `links with no accessible name:\n  ${unnamed.join('\n  ')}`).toEqual([]);
  });
});

test.describe('external links', () => {
  test('anything opening a new tab is protected against tabnabbing', async ({ page }) => {
    // target="_blank" without rel="noopener" hands the opened page a handle to this one via
    // window.opener, which it can use to navigate the original tab to a phishing page.
    const instances = await crawl(page);
    const unsafe = unique(
      instances
        .filter((l) => l.target === '_blank' && !(l.rel ?? '').includes('noopener'))
        .map((l) => l.href),
    );

    expect(unsafe, `target="_blank" without rel="noopener": ${unsafe.join(', ')}`).toEqual([]);
  });
});

test.describe('the 404 page itself', () => {
  test('offers a route onward rather than a dead end', async ({ page }) => {
    // Doc B §15: an indexed URL should never land on a bare 404.
    await page.goto('/no-such-page', { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle(/not found/i);

    const links = await collectLinks(page);
    const internal = links.filter((l) => l.href?.startsWith('/'));
    expect(internal.length, 'the 404 page must link somewhere').toBeGreaterThan(0);
    expect(internal.some((l) => l.href === '/')).toBe(true);
  });

  test('an unknown path under a real section still 404s cleanly', async ({ page }) => {
    // /shop/nonsense must not render an empty product page or crash the shell.
    await page.goto('/shop/definitely-not-a-product', { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle(/not found/i);
    await expect(page.locator('header')).toBeVisible();
  });
});
