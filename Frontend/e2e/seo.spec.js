import { test, expect } from '@playwright/test';

/**
 * Head tags in a real browser — `CONT-04`.
 *
 * `npm run seo` audits the source. These assert what a crawler actually receives after
 * React has run, which is a different question: a manifest entry that never reaches the DOM
 * because a page forgot to call the hook passes the static check and fails here.
 *
 * The unmount path matters as much as the mount path. `noindex` set by the 404 page and not
 * cleaned up would mark every page the visitor navigates to afterwards as noindex — the
 * kind of bug that removes a site from search results and is invisible in development.
 */

/**
 * Returns a meta tag's content, or null when the tag is absent.
 *
 * Absence is a meaningful, correct state here: `usePageMeta` removes `robots` entirely on
 * an indexable page rather than writing `index, follow`. A bare `.getAttribute()` waits for
 * an element that will never appear and fails on timeout instead of returning null.
 */
const meta = async (page, name) => {
  const tag = page.locator(`head meta[name="${name}"]`).first();
  return (await tag.count()) > 0 ? tag.getAttribute('content') : null;
};

const canonical = (page) => page.locator('head link[rel="canonical"]').getAttribute('href');

/** Waits for a meta tag to reach a value. `meta()` samples once and races the mount effect. */
const expectMeta = (page, name) => expect.poll(() => meta(page, name));

const PAGES = [
  { path: '/', title: 'Furniro', indexable: true },
  { path: '/shop', title: 'Shop — Furniro', indexable: true },
  { path: '/about', title: 'Blog — Furniro', indexable: true },
  { path: '/contact', title: 'Contact — Furniro', indexable: true },
  { path: '/cart', title: 'Cart — Furniro', indexable: false },
];

test.describe('page metadata', () => {
  for (const { path, title, indexable } of PAGES) {
    test(`${path} has a title, description and canonical`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveTitle(title);

      const description = await meta(page, 'description');
      expect(description, `${path} must have a meta description`).toBeTruthy();
      expect(description.length).toBeLessThanOrEqual(155);

      const href = await canonical(page);
      expect(href, `${path} must have a canonical URL`).toBeTruthy();
      expect(new URL(href).pathname).toBe(path);

      const robots = await meta(page, 'robots');
      if (indexable) {
        expect(robots ?? '').not.toContain('noindex');
      } else {
        expect(robots).toContain('noindex');
      }
    });
  }

  test('every page title is distinct', async ({ page }) => {
    // Duplicate titles are the CONT-04 failure Doc B §15 names directly.
    const titles = [];
    for (const { path, title } of PAGES) {
      await page.goto(path);
      // `toHaveTitle` retries; `page.title()` does not. React sets the head in an effect
      // that lands after `goto` resolves, so reading it directly races the first paint.
      await expect(page).toHaveTitle(title);
      titles.push(await page.title());
    }
    expect(new Set(titles).size).toBe(titles.length);
  });
});

test.describe('canonical URLs collapse filtered views', () => {
  test('a filtered shop URL is canonical to bare /shop', async ({ page }) => {
    // /shop?category=dining&page=2 and /shop?page=2&category=dining are one page to a
    // customer and two to a crawler. The canonical drops the query so they collapse.
    await page.goto('/shop?category=dining&sort=price_asc&page=2');
    expect(new URL(await canonical(page)).pathname).toBe('/shop');
    expect(await canonical(page)).not.toContain('?');
  });
});

test.describe('noindex does not leak between routes', () => {
  test('leaving the 404 page clears noindex', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expectMeta(page, 'robots').toContain('noindex');

    // Navigate within the SPA, not with a fresh load — a full reload would rebuild the head
    // from index.html and hide the leak this is looking for.
    await page.getByRole('link', { name: /home/i }).first().click();
    await expect(page).toHaveTitle('Furniro');
    expect((await meta(page, 'robots')) ?? '').not.toContain('noindex');
  });

  test('leaving the cart clears noindex', async ({ page, isMobile }) => {
    await page.goto('/cart');
    await expectMeta(page, 'robots').toContain('noindex');

    // At mobile widths the header links are hidden behind the drawer; the only <button>
    // in the header is the hamburger. Same pattern as navigation.spec.js.
    if (isMobile) await page.locator('header button').click();
    await page.getByRole('link', { name: 'Shop', exact: true }).first().click();
    await expect(page).toHaveTitle('Shop — Furniro');
    expect((await meta(page, 'robots')) ?? '').not.toContain('noindex');
  });
});

test.describe('data-driven pages', () => {
  test('a product page describes the product, not the shop', async ({ page }) => {
    await page.goto('/shop/syltherine');
    await expect(page).toHaveTitle('Syltherine — Furniro');

    const title = await page.title();
    expect(title).not.toBe('Shop — Furniro');

    expect(await meta(page, 'description')).toBeTruthy();
    expect(new URL(await canonical(page)).pathname).toBe(new URL(page.url()).pathname);
    expect((await meta(page, 'robots')) ?? '').not.toContain('noindex');
  });

  test('an unknown product slug is noindex', async ({ page }) => {
    // An SPA answers HTTP 200 for every path. Without noindex, every dead product URL
    // becomes an indexed page of thin content.
    await page.goto('/shop/no-such-product-exists');
    await expect(page).toHaveTitle(/not found/i);
    await expectMeta(page, 'robots').toContain('noindex');
  });
});
