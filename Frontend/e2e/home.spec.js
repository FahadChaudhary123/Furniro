import { test, expect } from '@playwright/test';

/**
 * The home page, and the derived-badge behaviour that replaced stored badges.
 */

/** The featured grid, identified by a product only it contains. */
const featuredGrid = (page) =>
  page.locator('.grid').filter({ has: page.getByRole('heading', { name: 'Syltherine' }) });

test.describe('home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Our Products' })).toBeVisible();
  });

  test('renders the hero', async ({ page }) => {
    await expect(page.getByText('New Era Collection')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Where Tomorrow/i })).toBeVisible();
  });

  test('the hero image loads', async ({ page }) => {
    const hero = page.getByAltText('Hero Background');
    await expect(hero).toBeVisible();
    // Was a 1.27 MB PNG of a photograph; now a 69 kB JPEG with a changed import.
    expect(await hero.evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
    expect(await hero.getAttribute('src')).toMatch(/\.jpg/);
  });

  test('renders the range categories', async ({ page }) => {
    for (const name of ['Dining', 'Living', 'Bedroom']) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
  });

  test('room cards open their matching shop categories', async ({ page }) => {
    for (const [name, slug, count] of [
      ['Dining', 'dining', 5],
      ['Living', 'living-room', 12],
      ['Bedroom', 'bedroom', 7],
    ]) {
      const link = page.locator('a').filter({ has: page.getByRole('heading', { name, exact: true }) });
      await expect(link).toHaveAttribute('href', `/shop?category=${slug}`);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`category=${slug}`));
      await expect(page.getByText(new RegExp(`of ${count} results`))).toBeVisible();
      await page.goto('/');
    }
  });

  test('room cards still open the shop when categories cannot load', async ({ page }) => {
    await page.route('**/api/categories', (route) => route.abort('failed'));
    await page.reload();
    const link = page.locator('a').filter({ has: page.getByRole('heading', { name: 'Dining', exact: true }) });
    await expect(link).toHaveAttribute('href', '/shop');
    await link.click();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(page.getByText(/of 40 results/)).toBeVisible();
  });

  test('shows exactly 8 featured products from the API', async ({ page }) => {
    // HomePage wraps every section in a <motion.section>, so filtering `section` by the
    // heading matches the outer wrapper as well and spans the whole page. Target the grid
    // that holds a known featured product instead.
    await expect(featuredGrid(page).locator('> div')).toHaveCount(8);
  });

  test('featured products are the curated set, in order', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Syltherine' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Leviosa' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Potty' })).toBeVisible();
  });

  test('every featured image loads', async ({ page }) => {
    const images = featuredGrid(page).locator('img');
    await expect(images).toHaveCount(8);
    const count = await images.count();

    // Lazy-loaded: scroll each into view, then wait for it to decode.
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((el) => el.naturalWidth), {
          message: `featured image ${i} should decode`,
          timeout: 10_000,
        })
        .toBeGreaterThan(0);
    }
  });

  test('discount badges are derived from the prices, not stored', async ({ page }) => {
    // Syltherine is Rp 2.500.000 against Rp 3.500.000 — that is 29%, not the 30% the old
    // hard-coded badge claimed. This assertion is the whole reason badges are derived.
    const card = page
      .locator('.group')
      .filter({ has: page.getByRole('heading', { name: 'Syltherine' }) });

    await expect(card.getByText('-29%')).toBeVisible();
    await expect(card.getByText('-30%')).toHaveCount(0);
  });

  test('a 50% discount is computed exactly', async ({ page }) => {
    const card = page
      .locator('.group')
      .filter({ has: page.getByRole('heading', { name: 'Lolito' }) });
    await expect(card.getByText('-50%')).toBeVisible();
  });

  test('recently created products carry a New badge', async ({ page }) => {
    // Checked-in dates age naturally. Supply a fresh date through the API so this
    // remains a browser test of badge rendering after the seed product ages out.
    await page.route('**/api/products/featured', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.data = body.data.map((product) =>
        product.name === 'Respira' ? { ...product, created_at: new Date().toISOString() } : product,
      );
      await route.fulfill({ response, body: JSON.stringify(body) });
    });
    await page.reload();

    const card = page
      .locator('.group')
      .filter({ has: page.getByRole('heading', { name: 'Respira' }) });
    await expect(card.getByText('New', { exact: true })).toBeVisible();
  });

  test('an undiscounted, older product carries no badge', async ({ page }) => {
    const card = page
      .locator('.group')
      .filter({ has: page.getByRole('heading', { name: 'Leviosa' }) });
    await expect(card.getByText(/^-\d+%$|^New$/)).toHaveCount(0);
  });

  test('Show More links to the shop', async ({ page }) => {
    const link = page.getByRole('link', { name: 'Show More' });
    await expect(link).toHaveAttribute('href', '/shop');
    await link.click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test('renders the footer', async ({ page }) => {
    await expect(page.locator('footer')).toBeVisible();
    await expect(page.getByText(/All rights reserved/i)).toBeVisible();
  });
});
