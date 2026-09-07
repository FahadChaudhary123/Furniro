import { test, expect } from '@playwright/test';

/**
 * What the storefront does when the API misbehaves.
 *
 * Once data comes over a network, "it renders" stops being the only case. A blank grid
 * reads as an empty catalogue, which is a worse lie than an error message.
 */

test.describe('API failure handling', () => {
  test('a network failure shows an error, not a blank page', async ({ page }) => {
    await page.route('**/api/products*', (route) => route.abort('failed'));
    await page.goto('/shop');

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Products could not be loaded')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('retry recovers once the API returns', async ({ page }) => {
    let fail = true;
    await page.route('**/api/products*', (route) =>
      fail ? route.abort('failed') : route.continue(),
    );

    await page.goto('/shop');
    await expect(page.getByText('Products could not be loaded')).toBeVisible({ timeout: 15_000 });

    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(page.getByText(/of 40 results/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('a 500 surfaces the correlation id for a bug report', async ({ page }) => {
    await page.route('**/api/products*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred.',
            correlationId: 'test-correlation-id-123',
          },
        }),
      }),
    );

    await page.goto('/shop');
    await expect(page.getByText('test-correlation-id-123')).toBeVisible({ timeout: 15_000 });
  });

  test('the home page degrades independently of the shop', async ({ page }) => {
    // Featured products fail; the rest of the page must still render.
    await page.route('**/api/products/featured*', (route) => route.abort('failed'));
    await page.goto('/');

    await expect(page.getByText('New Era Collection')).toBeVisible();
    await expect(page.getByText('Products could not be loaded')).toBeVisible({ timeout: 15_000 });
  });

  test('a slow API shows a loading skeleton', async ({ page }) => {
    await page.route('**/api/products*', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });

    await page.goto('/shop');
    await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    await expect(page.getByText(/of 40 results/)).toBeVisible({ timeout: 20_000 });
  });

  test('an empty result set says so rather than showing nothing', async ({ page }) => {
    await page.route('**/api/products?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { page: 1, limit: 16, total: 0, total_pages: 1 } }),
      }),
    );

    await page.goto('/shop');
    await expect(page.getByText(/No products match/i)).toBeVisible({ timeout: 15_000 });
  });
});
