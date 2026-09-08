import { test, expect } from '@playwright/test';

/**
 * The bundle and motion decisions, asserted in a browser.
 *
 * Written because the change that introduced them was only regression-checked: the existing
 * 251 tests still passed, which proved nothing had broken but said nothing about whether the
 * new behaviour worked. Code splitting, the CSS reveal and reduced-motion support had no
 * coverage at all.
 *
 * Byte budgets live in `scripts/check-budgets.mjs`; these are the behaviours a budget cannot
 * see.
 */

test.describe('code splitting', () => {
  test('the landing page loads without fetching a route chunk', async ({ page }) => {
    // HomePage is eagerly imported on purpose — lazy-loading the page you have just landed
    // on costs a round trip before anything renders.
    const scripts = [];
    page.on('request', (r) => r.resourceType() === 'script' && scripts.push(r.url()));

    await page.goto('/');
    await expect(page.getByText('New Era Collection')).toBeVisible();

    expect(scripts.some((u) => /\/assets\/(shop|Cart|about|contact)-/.test(u))).toBe(false);
  });

  test('navigating to the shop fetches its own chunk', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop navbar links are hidden below md; the drawer is tested separately');
    await page.goto('/');
    await expect(page.getByText('New Era Collection')).toBeVisible();

    const chunk = page.waitForRequest(
      (r) => r.resourceType() === 'script' && /\/assets\/shop-/.test(r.url()),
      { timeout: 15_000 },
    );
    await page.getByRole('link', { name: 'Shop', exact: true }).first().click();

    await expect(await chunk).toBeTruthy();
    await expect(page.getByText(/of 40 results/)).toBeVisible({ timeout: 15_000 });
  });

  test('the cart is not downloaded until it is visited', async ({ page }) => {
    const scripts = [];
    page.on('request', (r) => r.resourceType() === 'script' && scripts.push(r.url()));

    await page.goto('/about');
    await expect(page.getByRole('heading', { level: 1, name: 'Blog' })).toBeVisible();
    expect(scripts.some((u) => /\/assets\/Cart-/.test(u))).toBe(false);

    await page.goto('/cart');
    await expect(page.getByText('Your cart is empty')).toBeVisible();
    expect(scripts.some((u) => /\/assets\/Cart-/.test(u))).toBe(true);
  });

  test('a slow chunk shows the fallback on a direct load', async ({ page }) => {
    // Chunks normally arrive in milliseconds, so the fallback needs help to be observable.
    await page.route(/\/assets\/shop-.*\.js$/, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue();
    });

    // Entering the URL directly: there is no previous page to keep, so React shows the
    // Suspense fallback.
    page.goto('/shop').catch(() => {});

    await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    await expect(page.getByText('Loading page…')).toBeAttached();
    await expect(page.getByText(/of 40 results/)).toBeVisible({ timeout: 25_000 });
  });

  test('in-app navigation keeps the current page instead of flashing a fallback', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'desktop navbar links are hidden below md');

    /**
     * React Router navigates inside a transition, so React retains the previous UI while the
     * next route's chunk loads rather than unmounting to a fallback. The fallback above is
     * therefore only reachable on a direct load — worth pinning, because it is easy to
     * assume otherwise and write a fallback that never renders.
     */
    await page.route(/\/assets\/shop-.*\.js$/, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });

    await page.goto('/');
    await expect(page.getByText('New Era Collection')).toBeVisible();
    await page.getByRole('link', { name: 'Shop', exact: true }).first().click();

    // Mid-navigation: still the home page, no fallback, no blank frame.
    await page.waitForTimeout(500);
    await expect(page.getByText('New Era Collection')).toBeVisible();
    await expect(page.getByText('Loading page…')).toHaveCount(0);

    await expect(page.getByText(/of 40 results/)).toBeVisible({ timeout: 25_000 });
  });

  test('a chunk that never loads shows a recoverable error, not a blank page', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'desktop navbar links are hidden below md');

    /**
     * This is the post-deploy failure mode: a visitor holding the previous HTML asks for a
     * chunk filename that no longer exists and gets a 404. Without an error boundary the
     * rejected import unmounted the entire tree — navbar included — to a white page.
     */
    await page.route(/\/assets\/shop-.*\.js$/, (route) => route.abort('failed'));

    await page.goto('/');
    await page.getByRole('link', { name: 'Shop', exact: true }).first().click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('This page could not be loaded')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload the page' })).toBeVisible();
    // The shell survives: the visitor is not stranded.
    await expect(page.locator('header')).toBeVisible();
  });

  test('a direct load of a broken chunk also recovers', async ({ page }) => {
    await page.route(/\/assets\/shop-.*\.js$/, (route) => route.abort('failed'));
    await page.goto('/shop');

    await expect(page.getByText('This page could not be loaded')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Go to the home page' })).toBeVisible();
  });
});

test.describe('motion', () => {
  test('the home page reveal is applied', async ({ page }) => {
    await page.goto('/');
    const revealed = page.locator('.animate-reveal-up').first();
    await expect(revealed).toBeVisible();

    const name = await revealed.evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe('reveal-up');
  });

  test('the reveal settles to fully visible', async ({ page }) => {
    await page.goto('/');
    const revealed = page.locator('.animate-reveal-up').first();
    // `both` fill mode means it must not be left stuck at opacity 0.
    await expect
      .poll(() => revealed.evaluate((el) => getComputedStyle(el).opacity), { timeout: 5000 })
      .toBe('1');
  });

  test('prefers-reduced-motion disables the reveal', async ({ page }) => {
    // The Framer Motion implementation this replaced did not honour the preference at all.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const revealed = page.locator('.animate-reveal-up').first();
    const name = await revealed.evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe('none');

    // Content must still be visible — disabling the animation must not hide the page.
    await expect(page.getByText('New Era Collection')).toBeVisible();
    expect(await revealed.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  });

  test('no animation library ships to the browser', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const found = await page.evaluate(() =>
      Boolean(window.gsap || window.Motion || window.FramerMotion),
    );
    expect(found).toBe(false);
  });
});
