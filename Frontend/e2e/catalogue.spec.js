import { test, expect } from '@playwright/test';

/**
 * The catalogue: the data path that was rebuilt end to end.
 *
 * These assertions exist because each one was a real defect or a claim made about a fix:
 * 32 images that 404'd, prices in two currencies, badges that had drifted from their
 * prices, and sort controls that did nothing.
 */

const grid = (page) => page.locator('section').filter({ has: page.locator('.grid') }).locator('.grid').first();
const cards = (page) => grid(page).locator('> div');

test.describe('shop catalogue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/shop');
    // Wait for real data, not the skeleton.
    await expect(page.getByText(/Showing 1–16 of 40 results/)).toBeVisible({ timeout: 15_000 });
  });

  test('renders 16 products from the API', async ({ page }) => {
    await expect(cards(page)).toHaveCount(16);
  });

  test('reports the full catalogue total', async ({ page }) => {
    await expect(page.getByText(/of 40 results/)).toBeVisible();
  });

  test('every product image actually loads', async ({ page }) => {
    // The original defect: all 32 shop images 404'd. A src attribute is not enough —
    // naturalWidth is 0 for an image the browser failed to fetch.
    //
    // Images are loading="lazy", so a single scroll-to-bottom does not fetch them all on a
    // tall mobile viewport — the browser loads them as they approach. Bring each into view.
    const images = cards(page).locator('img');
    const count = await images.count();
    expect(count).toBe(16);

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      await img.scrollIntoViewIfNeeded();
      const src = await img.getAttribute('src');
      expect(src, `image ${i} has a src`).toBeTruthy();
      // Poll: the fetch is in flight the moment it scrolls in.
      await expect
        .poll(() => img.evaluate((el) => el.naturalWidth), {
          message: `image ${i} (${src}) should decode`,
          timeout: 10_000,
        })
        .toBeGreaterThan(0);
    }
  });

  test('every product image has alt text', async ({ page }) => {
    const images = cards(page).locator('img');
    for (let i = 0; i < (await images.count()); i++) {
      await expect(images.nth(i)).toHaveAttribute('alt', /.+/);
    }
  });

  test('prices render as rupiah, never rupees', async ({ page }) => {
    const body = await grid(page).innerText();
    expect(body).toMatch(/Rp\s?[\d.]+/);
    // `Rs` was rendered on the struck-through old price — two currencies on one card.
    expect(body).not.toMatch(/\bRs\b/);
  });

  test('prices are formatted, not raw integers', async ({ page }) => {
    const body = await grid(page).innerText();
    // Minor units would leak as e.g. "250000000".
    expect(body).not.toMatch(/\b\d{9,}\b/);
  });

  test('pagination offers exactly 3 pages', async ({ page }) => {
    for (const n of ['1', '2', '3']) {
      await expect(page.getByRole('button', { name: n, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: '4', exact: true })).toHaveCount(0);
  });

  test('the last page holds the remaining 8', async ({ page }) => {
    await page.getByRole('button', { name: '3', exact: true }).click();
    await expect(page.getByText(/Showing 33–40 of 40 results/)).toBeVisible();
    await expect(cards(page)).toHaveCount(8);
  });

  /**
   * Current price only. A discounted card renders two prices — the current one and a
   * struck-through original — so scraping every "Rp …" in the grid interleaves them and
   * makes correctly sorted output look unsorted.
   */
  const currentPrices = async (page) => {
    const texts = await cards(page).evaluateAll((els) =>
      els.map((el) => el.querySelector('.font-semibold')?.textContent ?? ''),
    );
    return texts
      .map((t) => t.match(/Rp\s?([\d.]+)/)?.[1])
      .filter(Boolean)
      .map((v) => Number(v.replaceAll('.', '')));
  };

  test('sorting by price ascending actually ascends', async ({ page }) => {
    await page.getByLabel('Sort products').selectOption('price:asc');
    await expect(page.getByText(/Showing 1–16 of 40 results/)).toBeVisible();

    const prices = await currentPrices(page);
    expect(prices).toHaveLength(16);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  test('sorting by price descending reverses it', async ({ page }) => {
    await page.getByLabel('Sort products').selectOption('price:desc');
    await expect(page.getByText(/Showing 1–16 of 40 results/)).toBeVisible();

    const prices = await currentPrices(page);
    expect(prices).toHaveLength(16);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  test('page size control changes the page size', async ({ page }) => {
    await page.getByLabel('Products per page').selectOption('32');
    await expect(page.getByText(/Showing 1–32 of 40 results/)).toBeVisible();
    await expect(cards(page)).toHaveCount(32);
    // 40 across 32 leaves 2 pages.
    await expect(page.getByRole('button', { name: '3', exact: true })).toHaveCount(0);
  });

  test('changing sort resets to page 1', async ({ page }) => {
    await page.getByRole('button', { name: '3', exact: true }).click();
    await expect(page.getByText(/Showing 33–40/)).toBeVisible();

    await page.getByLabel('Sort products').selectOption('name:asc');
    await expect(page.getByText(/Showing 1–16 of 40 results/)).toBeVisible();
  });

  test('product images are lazily loaded', async ({ page }) => {
    await expect(cards(page).locator('img').first()).toHaveAttribute('loading', 'lazy');
  });
});
