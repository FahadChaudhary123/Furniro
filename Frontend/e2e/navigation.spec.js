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

test.describe('404 handling', () => {
  test('an unknown path renders a 404 page, not a blank one', async ({ page }) => {
    await page.goto('/no-such-page');
    await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible();
    await expect(page.getByText('This page does not exist')).toBeVisible();
  });

  test('the 404 page offers a route onward', async ({ page }) => {
    await page.goto('/no-such-page');
    await page.getByRole('link', { name: 'Browse the shop' }).click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test('a deep unknown path is caught too', async ({ page }) => {
    await page.goto('/shop/deep/nonsense/path');
    await expect(page.getByRole('heading', { level: 1, name: '404' })).toBeVisible();
  });
});

test.describe('document titles', () => {
  for (const [path, expected] of [
    ['/', /^Furniro/],
    ['/shop', /^Shop — Furniro$/],
    ['/about', /^Blog — Furniro$/],
    ['/contact', /^Contact — Furniro$/],
    ['/no-such-page', /^Page not found — Furniro$/],
  ]) {
    test(`${path} sets its own title`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveTitle(expected);
    });
  }

  test('a product page is titled with the product', async ({ page }) => {
    await page.goto('/shop/syltherine');
    await expect(page).toHaveTitle(/^Syltherine — Furniro$/);
  });
});
