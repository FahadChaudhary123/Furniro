import { test, expect } from '@playwright/test';

test('the shop renders with the planned storefront CSP', async ({ page, context }) => {
  await context.grantPermissions(['local-network-access']);
  // Render adds this header after deployment. Exercise the same policy locally, with the
  // API origin changed to Playwright's HTTP test server.
  await page.route('**/shop', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: {
        ...response.headers(),
        'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:3100; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
      },
    });
  });

  const violations = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy|Refused to/i.test(message.text())) {
      violations.push(message.text());
    }
  });
  await page.goto('/shop');
  await expect(page.getByRole('searchbox', { name: 'Search products' })).toBeVisible();
  await expect(page.getByText('Syltherine').first()).toBeVisible();
  expect(violations).toEqual([]);
});
