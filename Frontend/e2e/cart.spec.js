import { test, expect } from '@playwright/test';

/**
 * The guest cart (`CART-01`).
 *
 * The cart stores only `{ slug, quantity }` — never a price. These assertions check that
 * decision holds, because a cart carrying its own price copy is a cart that shows
 * yesterday's price after a repricing.
 */

const addFirstProduct = async (page) => {
  await page.goto('/shop');
  await expect(page.getByText(/of 40 results/)).toBeVisible({ timeout: 15_000 });
  const card = page.locator('.group').first();
  await card.hover();
  await card.getByRole('button', { name: /Add .* to cart/ }).click();
};

test.describe('cart', () => {
  test('starts empty with no badge', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('cart-badge')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Cart, empty' })).toBeVisible();
  });

  test('the empty cart page offers a way out', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByText('Your cart is empty')).toBeVisible();
    await page.getByRole('link', { name: 'Browse the shop' }).click();
    await expect(page).toHaveURL(/\/shop$/);
  });

  test('adding a product updates the badge', async ({ page }) => {
    await addFirstProduct(page);
    await expect(page.getByTestId('cart-badge')).toHaveText('1');
  });

  test('adding the same product twice increments rather than duplicating', async ({ page }) => {
    await addFirstProduct(page);
    const card = page.locator('.group').first();
    await card.hover();
    await card.getByRole('button', { name: /Add .* to cart/ }).click();

    await expect(page.getByTestId('cart-badge')).toHaveText('2');
    await page.goto('/cart');
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
  });

  test('the cart survives a reload', async ({ page }) => {
    await addFirstProduct(page);
    await page.reload();
    await expect(page.getByTestId('cart-badge')).toHaveText('1');
  });

  test('the cart page shows the line with a server price', async ({ page }) => {
    await page.goto('/shop/syltherine');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await page.goto('/cart');

    await expect(page.getByTestId('cart-line')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Syltherine' })).toBeVisible();
    // Rp 2.500.000 comes from the API, not from anything the client stored.
    await expect(page.getByTestId('cart-subtotal')).toHaveText('Rp 2.500.000');
  });

  test('the subtotal multiplies by quantity', async ({ page }) => {
    await page.goto('/shop/syltherine');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await page.goto('/cart');

    await page.getByLabel('Quantity for Syltherine').fill('3');
    await expect(page.getByTestId('cart-subtotal')).toHaveText('Rp 7.500.000');
    await expect(page.getByTestId('cart-count')).toHaveText('3');
  });

  test('a line can be removed', async ({ page }) => {
    await page.goto('/shop/syltherine');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await page.goto('/cart');

    await page.getByRole('button', { name: 'Remove Syltherine from cart' }).click();
    await expect(page.getByText('Your cart is empty')).toBeVisible();
    await expect(page.getByTestId('cart-badge')).toHaveCount(0);
  });

  test('setting a quantity to zero removes the line', async ({ page }) => {
    await page.goto('/shop/syltherine');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await page.goto('/cart');

    await page.getByLabel('Quantity for Syltherine').fill('0');
    await expect(page.getByText('Your cart is empty')).toBeVisible();
  });

  test('the cart can be cleared', async ({ page }) => {
    await page.goto('/shop/syltherine');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await page.goto('/shop/lolito');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await page.goto('/cart');

    await expect(page.getByTestId('cart-line')).toHaveCount(2);
    await page.getByRole('button', { name: 'Clear cart' }).click();
    await expect(page.getByText('Your cart is empty')).toBeVisible();
  });

  test('stores no prices — only slug and quantity', async ({ page }) => {
    await page.goto('/shop/syltherine');
    await page.getByRole('button', { name: 'Add to cart' }).click();

    const stored = await page.evaluate(() => localStorage.getItem('furniro.cart.v1'));
    const parsed = JSON.parse(stored);
    expect(parsed).toEqual([{ slug: 'syltherine', quantity: 1 }]);
    // A price, name or image in storage is the defect this asserts against.
    expect(stored).not.toMatch(/price|name|image|Rp/i);
  });

  test('tampered storage cannot inject a price or a bad quantity', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem(
        'furniro.cart.v1',
        JSON.stringify([
          { slug: 'syltherine', quantity: 2, price: 1 },
          { slug: 'lolito', quantity: -5 },
          { slug: 'potty', quantity: 'many' },
          { nonsense: true },
        ]),
      );
    });
    await page.goto('/cart');

    // Only the valid line survives; the injected price is ignored because it is never read.
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
    await expect(page.getByTestId('cart-subtotal')).toHaveText('Rp 5.000.000');
  });

  test('corrupt storage does not break the page', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('furniro.cart.v1', 'not json at all'));
    await page.goto('/cart');

    await expect(page.getByText('Your cart is empty')).toBeVisible();
  });

  test('checkout is disabled rather than silently doing nothing', async ({ page }) => {
    await page.goto('/shop/syltherine');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await page.goto('/cart');

    await expect(page.getByRole('button', { name: /Checkout/ })).toBeDisabled();
  });

  test('logs no console errors', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto('/shop/syltherine');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });
});
