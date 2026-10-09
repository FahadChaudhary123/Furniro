import { test, expect } from '@playwright/test';

/**
 * Product detail — CAT-07. The `/api/products/:slug` endpoint existed since the catalogue
 * module landed; this page is the first thing to consume it.
 */

test.describe('product detail', () => {
  test('a product card links to its detail page', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.getByText(/of 40 results/)).toBeVisible({ timeout: 15_000 });

    // One accessible link per card: the image link is aria-hidden to avoid a duplicate.
    await expect(page.getByRole('link', { name: 'Nordic Wooden Chair' })).toHaveCount(1);
    await page.getByRole('link', { name: 'Nordic Wooden Chair' }).click();
    await expect(page).toHaveURL(/\/shop\/nordic-wooden-chair$/);
  });

  test('renders the product', async ({ page }) => {
    await page.goto('/shop/syltherine');

    await expect(page.getByRole('heading', { level: 1, name: 'Syltherine' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Syltherine' })).toBeVisible();
    await expect(page.getByText('Stylish cafe chair')).toBeVisible();
    await expect(page.getByText('Living Room')).toBeVisible();
  });

  test('shows the current and struck-through prices', async ({ page }) => {
    await page.goto('/shop/syltherine');
    await expect(page.getByText('Rp 2.500.000')).toBeVisible();
    await expect(page.getByText('Rp 3.500.000')).toBeVisible();
  });

  test('shows the derived discount badge', async ({ page }) => {
    await page.goto('/shop/syltherine');
    // Derived from the two prices — 29%, not the 30% the old stored badge claimed.
    await expect(page.getByText('-29%')).toBeVisible();
  });

  test('a shop card image opens its product despite the hover actions', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.getByText(/of 40 results/)).toBeVisible({ timeout: 15_000 });
    const imageLink = page.locator('a[aria-hidden="true"][href="/shop/nordic-wooden-chair"]');
    await imageLink.click({ position: { x: 10, y: 100 }, timeout: 5_000 });
    await expect(page).toHaveURL(/\/shop\/nordic-wooden-chair$/);
  });

  test('the shop card hover action still adds a product', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.getByText(/of 40 results/)).toBeVisible({ timeout: 15_000 });
    const card = page.locator('.group').filter({
      has: page.getByRole('link', { name: 'Nordic Wooden Chair' }),
    });
    await card.hover();
    await card.getByRole('button', { name: 'Add Nordic Wooden Chair to cart' }).click();
    await page.goto('/cart');
    await expect(page.getByRole('link', { name: 'Nordic Wooden Chair' })).toBeVisible();
  });

  test('adds the chosen quantity and shows the remaining cart limit', async ({ page }) => {
    await page.goto('/shop/syltherine');
    await page.getByLabel('Quantity').fill('3');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByText('3 in cart. You can add 96 more.')).toBeVisible();
    await page.goto('/cart');
    await expect(page.getByLabel('Quantity for Syltherine')).toHaveValue('3');
  });

  test('rejects invalid quantities and stops at the per-product limit', async ({ page }) => {
    await page.goto('/shop/syltherine');
    await page.getByLabel('Quantity').fill('0');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByRole('alert')).toContainText('Choose a whole quantity from 1 to 99.');

    await page.getByLabel('Quantity').fill('99');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByText('Maximum quantity in cart.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to cart' })).toBeDisabled();
    await page.goto('/cart');
    await expect(page.getByLabel('Quantity for Syltherine')).toHaveValue('99');
  });

  test('the product image loads', async ({ page }) => {
    await page.goto('/shop/lolito');
    const img = page.getByAltText('Lolito');
    await expect(img).toBeVisible();
    await expect
      .poll(() => img.evaluate((el) => el.naturalWidth), { timeout: 10_000 })
      .toBeGreaterThan(0);
  });

  test('breadcrumb leads back to the shop', async ({ page }) => {
    await page.goto('/shop/potty');
    await page.getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Shop' })
      .click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test('an unknown slug says the product is missing, not that the site broke', async ({ page }) => {
    await page.goto('/shop/does-not-exist');

    await expect(page.getByText('Product not found')).toBeVisible({ timeout: 15_000 });
    // A 404 is not a failure: no error panel, no retry.
    await expect(page.getByText('Products could not be loaded')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Back to shop' })).toBeVisible();
  });

  test('a real failure is distinguished from a missing product', async ({ page }) => {
    await page.route('**/api/products/*', (route) => route.abort('failed'));
    await page.goto('/shop/syltherine');

    await expect(page.getByText('Products could not be loaded')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Product not found')).toHaveCount(0);
  });

  test('logs no console errors', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/shop/syltherine');
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });
});
