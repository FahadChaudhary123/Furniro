import { test, expect } from '@playwright/test';

/**
 * The blog, and the placeholder content it used to ship.
 *
 * Before the content module the sidebar showed five copies of "Sample blog title here"
 * dated 03 Aug 2022, and the category counts were invented — Crafts 2, Design 8, Handmade
 * 7, Wood 6 — against three real posts. Both reached production. These assertions exist so
 * neither comes back.
 */

test.describe('blog listing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: 'Featured Design Trends for 2022' }))
      .toBeVisible({ timeout: 15_000 });
  });

  test('renders posts from the API', async ({ page }) => {
    await expect(page.locator('article')).toHaveCount(3);
  });

  test('posts are newest first', async ({ page }) => {
    const dates = await page.locator('article time').evaluateAll((els) =>
      els.map((el) => el.getAttribute('datetime')),
    );
    expect(dates).toHaveLength(3);
    const sorted = [...dates].sort((a, b) => new Date(b) - new Date(a));
    expect(dates).toEqual(sorted);
  });

  test('dates are machine-readable, not display strings', async ({ page }) => {
    // The old data stored "14 Oct 2022", which cannot be sorted or compared.
    const iso = await page.locator('article time').first().getAttribute('datetime');
    expect(Number.isNaN(Date.parse(iso))).toBe(false);
  });

  test('no placeholder content is rendered', async ({ page }) => {
    await expect(page.getByText('Sample blog title here')).toHaveCount(0);
    await expect(page.getByText('03 Aug 2022')).toHaveCount(0);
  });

  test('category counts match the posts that exist', async ({ page }) => {
    const counts = await page
      .locator('h3:has-text("Categories") + ul li')
      .evaluateAll((els) => els.map((el) => Number(el.lastElementChild.textContent)));

    expect(counts.length).toBeGreaterThan(0);
    // Every post has exactly one tag, so the counts must sum to the post total.
    expect(counts.reduce((a, b) => a + b, 0)).toBe(3);
    // The fabricated numbers were 2, 8, 7, 1, 6 — none can exceed the post count.
    expect(Math.max(...counts)).toBeLessThanOrEqual(3);
  });

  test('recent posts are real posts that link somewhere', async ({ page }) => {
    const recent = page.locator('h3:has-text("Recent Posts") + ul li a');
    await expect(recent).toHaveCount(3);
    await expect(recent.first()).toHaveAttribute('href', /^\/blog\/[a-z0-9-]+$/);
  });

  test('every blog image loads', async ({ page }) => {
    const images = page.locator('article img');
    const count = await images.count();
    expect(count).toBe(3);

    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((el) => el.naturalWidth), { timeout: 10_000 })
        .toBeGreaterThan(0);
    }
  });

  test('Read more reaches the post', async ({ page }) => {
    await page.getByRole('link', { name: 'Read more' }).first().click();
    await expect(page).toHaveURL(/\/blog\/[a-z0-9-]+$/);
  });
});

test.describe('blog post', () => {
  test('renders the article', async ({ page }) => {
    await page.goto('/blog/featured-design-trends-for-2022');

    await expect(page.getByRole('heading', { level: 2, name: 'Featured Design Trends for 2022' }))
      .toBeVisible();
    // Scoped to the byline: "Wood" also appears in the article body.
    const byline = page.locator('article').getByText('Admin').locator('..');
    await expect(byline.getByText('Admin', { exact: true })).toBeVisible();
    await expect(byline.getByText('Wood', { exact: true })).toBeVisible();
    // Body renders as paragraphs, not one run-on block.
    await expect(page.locator('article p')).not.toHaveCount(0);
  });

  test('sets its own document title', async ({ page }) => {
    await page.goto('/blog/creating-spaces-that-inspire-productivity');
    await expect(page).toHaveTitle(/^Creating spaces that inspire productivity — Furniro$/);
  });

  test('an unknown slug says the post is missing, not that the site broke', async ({ page }) => {
    await page.goto('/blog/no-such-article');

    await expect(page.getByText('Post not found')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Products could not be loaded')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Back to the blog' })).toBeVisible();
  });

  test('a real failure is distinguished from a missing post', async ({ page }) => {
    await page.route('**/api/posts/*', (route) => route.abort('failed'));
    await page.goto('/blog/featured-design-trends-for-2022');

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Post not found')).toHaveCount(0);
  });

  test('the blog degrades without taking the page down', async ({ page }) => {
    await page.route('**/api/posts?*', (route) => route.abort('failed'));
    await page.goto('/about');

    await expect(page.getByRole('heading', { level: 1, name: 'Blog' })).toBeVisible();
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
  });

  test('logs no console errors', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/blog/going-all-in-with-millennial-design');
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });
});
