import { test, expect } from '@playwright/test';

const ROUTES = ['/', '/shop', '/about', '/contact'];

test.describe('page quality', () => {
  for (const route of ROUTES) {
    test(`${route} logs no console errors`, async ({ page }) => {
      const errors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', (err) => errors.push(String(err)));

      await page.goto(route);
      await page.waitForLoadState('networkidle');

      expect(errors, `console errors on ${route}`).toEqual([]);
    });

    test(`${route} requests nothing that 404s`, async ({ page }) => {
      const failures = [];
      page.on('response', (res) => {
        if (res.status() >= 400) failures.push(`${res.status()} ${res.url()}`);
      });

      await page.goto(route);
      await page.waitForLoadState('networkidle');

      expect(failures, `failed requests on ${route}`).toEqual([]);
    });

    test(`${route} gives every image alt text`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const missing = await page.$$eval('img', (imgs) =>
        imgs.filter((i) => !i.getAttribute('alt')).map((i) => i.getAttribute('src')),
      );
      expect(missing, `images without alt on ${route}`).toEqual([]);
    });

    test(`${route} has at least one h1`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const count = await page.locator('h1').count();
      expect(count, `h1 count on ${route}`).toBeGreaterThan(0);
    });
  }

  test('the contact form exposes its fields', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.getByRole('heading', { name: 'Get In Touch With Us' })).toBeVisible();
    // The form has no submit handler yet — see CHANGELOG.md#known-issues. This only checks
    // the fields are present and reachable.
    await expect(page.locator('form input, form textarea')).not.toHaveCount(0);
  });

  test('the blog renders on /about', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('img').first()).toBeVisible();
    const images = page.locator('img');
    for (let i = 0; i < Math.min(await images.count(), 6); i++) {
      expect(await images.nth(i).evaluate((el) => el.naturalWidth)).toBeGreaterThan(0);
    }
  });

  test('no page ships a third-party script', async ({ page }) => {
    // Doc B §12: most storefront regressions arrive as a marketing tag, not app code.
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const external = await page.$$eval('script[src]', (els) =>
      els.map((e) => e.src).filter((s) => !s.startsWith(window.location.origin)),
    );
    expect(external).toEqual([]);
  });
});

test.describe('API contract, from the browser', () => {
  test('CORS allows the storefront origin', async ({ page }) => {
    await page.goto('/');
    // import.meta is not available inside page.evaluate — pass the URL in.
    const result = await page
      .evaluate(async (url) => {
        const res = await fetch(url);
        return { ok: res.ok, status: res.status, count: (await res.json()).data.length };
      }, 'http://localhost:3100/api/categories')
      .catch((e) => ({ error: String(e) }));

    expect(result.error, 'a cross-origin fetch from the storefront should not be blocked').toBeUndefined();
    expect(result.ok).toBe(true);
    expect(result.count).toBe(7);
  });
});
