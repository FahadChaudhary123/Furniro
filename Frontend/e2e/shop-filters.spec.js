import { test, expect } from '@playwright/test';

/**
 * Shop state lives in the URL.
 *
 * Written because the category link on every product page pointed at `/shop?category=…`
 * and did nothing: the grid kept its state in `useState` and never read the query string.
 * A link that silently no-ops is worse than a missing one.
 */

const settled = (page) => expect(page.getByText(/of \d+ results/)).toBeVisible({ timeout: 15_000 });

test.describe('filtering by URL', () => {
  test('a category in the URL filters the grid on first load', async ({ page }) => {
    await page.goto('/shop?category=living-room');
    await expect(page.getByText(/of 12 results/)).toBeVisible({ timeout: 15_000 });
  });

  test('the category link on a product page actually filters', async ({ page }) => {
    await page.goto('/shop/syltherine');
    await page.getByRole('link', { name: 'Living Room' }).click();

    await expect(page).toHaveURL(/\/shop\?category=living-room/);
    await expect(page.getByText(/of 12 results/)).toBeVisible({ timeout: 15_000 });
  });

  test('a search term in the URL filters the grid', async ({ page }) => {
    await page.goto('/shop?q=sofa');
    await settled(page);

    const total = Number((await page.getByText(/of \d+ results/).innerText()).match(/of (\d+)/)[1]);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(40);
  });

  test('an unknown category is rejected by the API, not silently ignored', async ({ page }) => {
    await page.goto('/shop?category=not-a-category');
    // The server validates against its own list and returns 400; the client surfaces it.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('filter controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/shop');
    await settled(page);
  });

  test('clicking a category updates the URL and the grid', async ({ page }) => {
    await page.getByRole('button', { name: /^Bedroom/ }).click();

    await expect(page).toHaveURL(/category=bedroom/);
    await expect(page.getByText(/of 7 results/)).toBeVisible();
  });

  test('category buttons show real counts that sum to the catalogue', async ({ page }) => {
    const labels = await page
      .locator('button[aria-pressed]')
      .evaluateAll((els) => els.map((e) => e.textContent));
    const counts = labels
      .map((t) => t.match(/\((\d+)\)/)?.[1])
      .filter(Boolean)
      .map(Number);

    expect(counts).toHaveLength(7);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(40);
  });

  test('searching updates the URL', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Search products' }).fill('chair');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page).toHaveURL(/q=chair/);
    await settled(page);
  });

  test('a search with no matches explains itself', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Search products' }).fill('zzzznothing');
    await page.getByRole('button', { name: 'Search' }).click();

    await expect(page.getByText(/No products match “zzzznothing”/)).toBeVisible({ timeout: 15_000 });
  });

  test('clear filters removes them from the URL', async ({ page }) => {
    await page.getByRole('button', { name: /^Decor/ }).click();
    await expect(page).toHaveURL(/category=decor/);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).not.toHaveURL(/category=/);
    await expect(page.getByText(/of 40 results/)).toBeVisible();
  });

  test('changing a filter returns to page 1', async ({ page }) => {
    await page.getByRole('button', { name: '3', exact: true }).click();
    await expect(page).toHaveURL(/page=3/);

    await page.getByRole('button', { name: /^Bedroom/ }).click();
    await expect(page).not.toHaveURL(/page=/);
    await expect(page.getByText(/Showing 1–/)).toBeVisible();
  });

  test('defaults are kept out of the URL', async ({ page }) => {
    // sort=created_at:desc, page=1 and limit=16 are defaults and should not clutter it.
    await page.getByLabel('Sort products').selectOption('created_at:desc');
    await expect(page).not.toHaveURL(/sort=/);

    await page.getByLabel('Products per page').selectOption('32');
    await expect(page).toHaveURL(/limit=32/);
    await page.getByLabel('Products per page').selectOption('16');
    await expect(page).not.toHaveURL(/limit=/);
  });
});

test.describe('browser history', () => {
  test('the back button undoes a filter', async ({ page }) => {
    await page.goto('/shop');
    await settled(page);

    await page.getByRole('button', { name: /^Office/ }).click();
    await expect(page.getByText(/of 5 results/)).toBeVisible();

    await page.goBack();
    await expect(page.getByText(/of 40 results/)).toBeVisible();
  });

  test('a filtered view is shareable', async ({ page, context }) => {
    await page.goto('/shop');
    await settled(page);
    await page.getByRole('button', { name: /^Outdoor/ }).click();
    await expect(page.getByText(/of 4 results/)).toBeVisible();

    const url = page.url();
    const other = await context.newPage();
    await other.goto(url);
    await expect(other.getByText(/of 4 results/)).toBeVisible({ timeout: 15_000 });
    await other.close();
  });

  test('the search box reflects the URL after going back', async ({ page }) => {
    await page.goto('/shop?q=lamp');
    await settled(page);
    await expect(page.getByRole('searchbox', { name: 'Search products' })).toHaveValue('lamp');

    await page.goto('/shop');
    await settled(page);
    await expect(page.getByRole('searchbox', { name: 'Search products' })).toHaveValue('');
  });
});

test.describe('navbar search', () => {
  test('the search icon reaches the shop', async ({ page, isMobile }) => {
    test.skip(isMobile, 'icon row is desktop-only');
    await page.goto('/');
    await page.getByRole('link', { name: 'Search products' }).click();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(page.getByRole('searchbox', { name: 'Search products' })).toBeVisible();
  });

  test('the navbar link and the search box are distinguishable by role', async ({ page, isMobile }) => {
    test.skip(isMobile, 'icon row is desktop-only');
    await page.goto('/shop');
    // Same accessible name, different roles — which is how assistive tech tells them apart.
    await expect(page.getByRole('link', { name: 'Search products' })).toHaveCount(1);
    await expect(page.getByRole('searchbox', { name: 'Search products' })).toHaveCount(1);
  });
});
