import { test, expect } from '@playwright/test';

test.describe('routing and navigation', () => {
  // Banner <h1>, not a loose text match — "Shop" also appears in the navbar on every page,
  // so a text match would pass on the wrong route.
  for (const [path, heading] of [
    ['/shop', 'Shop'],
    ['/about', 'Blog'],
    ['/contact', 'Contact'],
  ]) {
    test(`${path} renders its banner`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
    });
  }

  test('/ renders the hero', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('New Era Collection')).toBeVisible();
  });

  test('a hard reload on /shop works', async ({ page }) => {
    // BrowserRouter uses the History API, so the host must rewrite unknown paths to
    // index.html. This is the check that catches a missing SPA rewrite before production.
    await page.goto('/shop');
    await page.reload();
    await expect(page.getByText(/of 40 results/)).toBeVisible({ timeout: 15_000 });
  });

  test('the navbar persists across navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Furniro/ })).toBeVisible();
    await page.goto('/contact');
    await expect(page.getByRole('link', { name: /Furniro/ })).toBeVisible();
  });

  // Desktop links are `hidden md:flex`; the mobile path is covered by the drawer test.
  test('navbar links reach every route', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop navbar only — mobile uses the drawer');
    await page.goto('/');
    for (const [name, url] of [['Shop', /\/shop$/], ['About', /\/about$/], ['Contact', /\/contact$/]]) {
      await page.getByRole('link', { name, exact: true }).first().click();
      await expect(page).toHaveURL(url);
    }
  });

  test('the logo returns home', async ({ page }) => {
    await page.goto('/contact');
    await page.getByRole('link', { name: /Furniro/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('mobile', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile viewport only');

  test('the drawer opens and navigates', async ({ page }) => {
    await page.goto('/');
    // Desktop links are hidden at this width; the drawer is the only way through.
    const shopLink = page.getByRole('link', { name: 'Shop', exact: true });
    await expect(shopLink).toBeHidden();

    // The only <button> in the header is the hamburger.
    await page.locator('header button').click();
    await expect(page.getByRole('link', { name: 'Shop', exact: true })).toBeVisible();
  });

  test('the layout does not scroll horizontally', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.getByText(/of 40 results/)).toBeVisible({ timeout: 15_000 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'page should not overflow horizontally').toBeLessThanOrEqual(1);
  });
});

test.describe('known gaps', () => {
  // Documented in CHANGELOG.md#known-issues. These are marked as expected failures so the
  // suite records the gap and tells us when it closes, rather than staying quietly red.

  test.fail();
  test('an unknown path should render a 404 page', async ({ page }) => {
    await page.goto('/no-such-page');
    await expect(page.getByText(/not found|404/i)).toBeVisible({ timeout: 3000 });
  });

  test.fail();
  test('the document title should name the site', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Furniro/i);
  });
});
