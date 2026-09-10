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

/**
 * These match the lazy chunk for `/shop` by filename. Vite derives that name from the page
 * component's file, so renaming `shop.jsx` to `Shop.jsx` renamed the chunk and broke five
 * patterns at once — hence the `i` flag rather than a hardcoded case. If the coupling
 * becomes a problem again, match on the route being loaded instead of the asset name.
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
      (r) => r.resourceType() === 'script' && /\/assets\/shop-/i.test(r.url()),
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
    await page.route(/\/assets\/shop-.*\.js$/i, async (route) => {
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
    await page.route(/\/assets\/shop-.*\.js$/i, async (route) => {
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
    await page.route(/\/assets\/shop-.*\.js$/i, (route) => route.abort('failed'));

    await page.goto('/');
    await page.getByRole('link', { name: 'Shop', exact: true }).first().click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('This page could not be loaded')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reload the page' })).toBeVisible();
    // The shell survives: the visitor is not stranded.
    await expect(page.locator('header')).toBeVisible();
  });

  test('a direct load of a broken chunk also recovers', async ({ page }) => {
    await page.route(/\/assets\/shop-.*\.js$/i, (route) => route.abort('failed'));
    await page.goto('/shop');

    await expect(page.getByText('This page could not be loaded')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Go to the home page' })).toBeVisible();
  });
});

test.describe('images', () => {
  test('a modern browser is served AVIF, not WebP or the JPEG fallback', async ({ page }) => {
    const images = [];
    page.on('response', (r) => {
      const u = r.url();
      if (/\.(jpe?g|png|webp|avif)$/i.test(u)) images.push(u.split('/').pop());
    });

    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState('networkidle');

    const avif = images.filter((f) => f.endsWith('.avif'));
    const webp = images.filter((f) => f.endsWith('.webp'));
    const jpeg = images.filter((f) => /\.(jpe?g|png)$/i.test(f));

    // AVIF measured 42.7% smaller than WebP across this project's images. Chromium accepts
    // it, so it must be what arrives — a <source> listed after one the browser can already
    // decode is never even considered.
    expect(avif.length, 'Chromium accepts AVIF and should receive it').toBeGreaterThan(0);

    // Neither fallback may be fetched alongside it: that would multiply the payload rather
    // than reduce it, which is the failure mode this whole arrangement exists to avoid.
    expect(webp, 'no WebP should be fetched alongside an AVIF').toEqual([]);
    expect(jpeg, 'no JPEG should be fetched alongside an AVIF').toEqual([]);
  });

  test('every picture offers AVIF, then WebP, then the original', async ({ page }) => {
    // Order is the whole mechanism: a browser takes the FIRST source it can decode and never
    // looks further, so the smallest format has to be first. Listed after WebP, the AVIF
    // would never be chosen by any browser that supports both.
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const shapes = await page.$$eval('picture', (els) =>
      els.map((el) => ({
        types: [...el.querySelectorAll('source')].map((s) => s.getAttribute('type')),
        fallback: el.querySelector('img')?.getAttribute('src') ?? null,
      })),
    );

    expect(shapes.length, 'the page should render <picture> elements').toBeGreaterThan(0);

    for (const { types, fallback } of shapes) {
      const avifAt = types.indexOf('image/avif');
      const webpAt = types.indexOf('image/webp');

      // AVIF is optional — it is omitted where it measured LARGER than the WebP, which
      // happens on very small images. When present it must lead.
      if (avifAt !== -1 && webpAt !== -1) expect(avifAt).toBeLessThan(webpAt);

      // The <img> is the last resort and must never itself be a modern format, or a browser
      // that understands none of the sources gets nothing.
      expect(fallback, 'every <picture> needs a fallback <img>').toBeTruthy();
      expect(fallback).toMatch(/\.(jpe?g|png)$/i);
    }
  });

  test('no image is inlined as a base64 data URI', async ({ page }) => {
    // An inlined AVIF lives in the JS bundle EVERY browser downloads, so a browser that
    // would have taken the WebP pays for AVIF bytes it will never decode — which defeats the
    // point of offering formats at all. Vite inlines under 4 kB by default; AVIF made
    // several images small enough to cross that line and gzipped JS grew 18 kB.
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const inlined = await page.$$eval('picture source, img', (els) =>
      els
        .map((el) => el.getAttribute('srcset') ?? el.getAttribute('src') ?? '')
        .filter((v) => v.startsWith('data:image/')),
    );
    expect(inlined, 'assetsInlineLimit must stay at 0').toEqual([]);
  });

  test('the JPEG fallback is still reachable', async ({ page }) => {
    // <picture> is only safe if the fallback works for anything that cannot decode WebP.
    await page.goto('/');
    const fallback = await page.locator('picture img').first().getAttribute('src');
    expect(fallback).toMatch(/\.(jpe?g|png)$/i);

    const res = await page.request.get(fallback);
    expect(res.status()).toBe(200);
  });

  test('images are not oversized for the box they render into', async ({ page, isMobile }) => {
    test.skip(isMobile, 'display widths in image-display-widths.mjs are measured at desktop');

    /**
     * Guards scripts/image-display-widths.mjs. Those numbers drive how every image is
     * resized, so a layout change that widens a slot silently ships a blurry image, and one
     * that narrows it silently ships wasted bytes. Six files once held 1.1 MB of pure waste
     * this way.
     */
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState('networkidle');

    const oversized = await page.$$eval('img', (els) =>
      els
        .map((e) => ({
          src: e.currentSrc.split('/').pop(),
          natural: e.naturalWidth,
          shown: Math.round(e.getBoundingClientRect().width),
        }))
        // 4x rather than 2x (the retina target) because a few assets deliberately serve
        // more than one slot from a single file: a product image appears at ~288px in the
        // featured strip and ~600px on its detail page, and without `srcset` one file has
        // to satisfy the larger. `srcset` is the proper fix and is on the perf backlog;
        // this threshold still catches gross waste like a 1600px file in a 384px slot.
        .filter((x) => x.natural > 0 && x.shown > 0 && x.natural / x.shown > 4)
        .map((x) => `${x.src}: ${x.natural}px in a ${x.shown}px box`),
    );

    expect(oversized, 'resize these, or update scripts/image-display-widths.mjs').toEqual([]);
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
