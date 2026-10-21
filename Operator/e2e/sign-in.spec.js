import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const factor = { id: '11111111-1111-4111-8111-111111111111', factor_type: 'totp', status: 'verified', friendly_name: 'Furniro operator' };
const user = { id: '22222222-2222-4222-8222-222222222222', aud: 'authenticated', role: 'authenticated', email: 'operator@example.test', factors: [factor] };
function session(aal = 'aal1', factors = [factor]) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return { access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, aal, exp: Math.floor(Date.now()/1000)+3600 })}.synthetic`, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, user: { ...user, factors } };
}
async function mock(page, { enrolled = true, denied = false, badPassword = false, badCode = false, disabled = false } = {}) {
  let verified = false;
  const factors = enrolled ? [factor] : [];
  await page.route('**/api/operator/**', async route => {
    const config = route.request().url().endsWith('auth-config');
    await route.fulfill({ status: !config && denied ? 403 : 200, json: config
      ? disabled ? { enabled: false } : { enabled: true, url: 'https://operator.example.test', publishable_key: 'sb_publishable_synthetic' }
      : { operator_id: user.id, roles: ['fulfilment'] } });
  });
  await page.route('https://operator.example.test/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/token')) return route.fulfill({ status: badPassword ? 400 : 200, json: badPassword ? { msg: 'Invalid credentials' } : session('aal1', factors) });
    if (path.endsWith('/user')) return route.fulfill({ json: { ...user, factors: verified ? [factor] : factors } });
    if (path.endsWith('/challenge')) return route.fulfill({ json: { id: 'challenge', expires_at: 9999999999 } });
    if (path.endsWith('/verify')) { verified = true; return route.fulfill({ status: badCode ? 422 : 200, json: badCode ? { msg: 'Invalid code' } : session('aal2') }); }
    if (path.endsWith('/factors')) return route.fulfill({ json: { id: factor.id, type: 'totp', totp: { secret: 'SYNTHETICSETUPKEY', qr_code: '', uri: '' } } });
    if (path.endsWith('/logout')) return route.fulfill({ status: 204 });
    throw new Error(`Unexpected mock auth request: ${path}`);
  });
}
async function login(page) {
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('operator@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
async function code(page) {
  await page.getByLabel('Authenticator code', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
}
test('MFA sign-in checks server roles, keeps storage empty, and signs out', async ({ page }) => {
  await mock(page); await login(page); await code(page);
  await expect(page.getByRole('heading', { name: 'Operator access verified' })).toBeVisible();
  await expect(page.getByText('fulfilment', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
});
test('new operator enrols an authenticator and reload discards session', async ({ page }) => {
  await mock(page, { enrolled: false }); await login(page);
  await page.getByRole('button', { name: 'Set up authenticator' }).click();
  await expect(page.getByLabel('Authenticator setup key')).toHaveText('SYNTHETICSETUPKEY');
  await code(page); await expect(page.getByText('You are signed in.')).toBeVisible();
  await expect(page.getByText('SYNTHETICSETUPKEY')).toHaveCount(0);
  await page.reload(); await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
});
test('invalid credentials stay on login without leaking form into URL', async ({ page }) => {
  await mock(page, { badPassword: true }); await login(page);
  await expect(page.getByRole('alert')).toContainText('Unable to sign in');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  expect(new URL(page.url()).search).toBe('');
});
test('invalid MFA code allows retry', async ({ page }) => {
  await mock(page, { badCode: true }); await login(page); await code(page);
  await expect(page.getByRole('alert')).toContainText('fresh code');
  await expect(page.getByRole('button', { name: 'Verify code' })).toBeEnabled();
});
test('server denial never shows authenticated workspace', async ({ page }) => {
  await mock(page, { denied: true }); await login(page); await code(page);
  await expect(page.getByRole('alert')).toContainText('access was denied');
  await expect(page.getByText('You are signed in.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeEnabled();
});
test('disabled configuration is accessible and does not collect credentials', async ({ page }) => {
  await mock(page, { disabled: true }); await page.goto('/');
  await expect(page.getByText(/Operator sign-in is not configured/)).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test('unavailable API offers retry', async ({ page }) => {
  await page.route('**/api/operator/auth-config', route => route.abort());
  await page.goto('/'); await expect(page.getByRole('alert')).toContainText('could not load');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
});
test('expiry locks the workspace until a fresh sign-in', async ({ page }) => {
  await page.clock.install();
  await mock(page); await login(page); await code(page);
  await expect(page.getByText('You are signed in.')).toBeVisible();
  await page.clock.fastForward(3601000);
  await expect(page.getByText(/Your session expired/)).toBeVisible();
  await expect(page.getByText('fulfilment', { exact: true })).toHaveCount(0);
});
test('login form is accessible and provider outages allow retry', async ({ page }) => {
  await mock(page);
  await page.goto('/');
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `test-results/operator-login-${test.info().project.name}.png`, fullPage: true });
  await page.route('https://operator.example.test/**', route => route.abort());
  await login(page);
  await expect(page.getByRole('alert')).toContainText('Unable to sign in');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
});

const orderId = '33333333-3333-4333-8333-333333333333';
const savedOrder = {
  order_id: orderId, currency: 'PKR', payment_method: 'cod', status: 'delivered',
  created_at: '2026-10-15T10:00:00Z', subtotal_minor: 2000, discount_minor: 0,
  shipping_minor: 125, tax_minor: 0, total_minor: 2125,
  items: [{ line_number: 1, product_slug: 'test-chair', product_name: 'Saved test chair', quantity: 2, unit_price_minor: 1000, line_total_minor: 2000 }],
  delivery: { recipient_name: 'Synthetic buyer', phone: '+92 300 0000000', address_line1: 'Test street', address_line2: '', city: 'Lahore', postal_code: '', country: 'PK' },
};
async function findOrder(page) {
  await page.getByLabel('Order ID', { exact: true }).fill(orderId);
  await page.getByRole('button', { name: 'Find order', exact: true }).click();
}
test('order lookup renders stored details accessibly and clears them on sign-out', async ({ page }) => {
  await mock(page);
  await page.route('**/api/operator/orders/*', async route => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    await route.fulfill({ json: savedOrder });
  });
  await login(page); await code(page); await findOrder(page);
  await expect(page.getByText('Saved test chair')).toBeVisible();
  await expect(page.getByText('Synthetic buyer')).toBeVisible();
  await expect(page.getByText('PKR 21.25', { exact: true })).toBeVisible();
  await expect(page.getByText('Delivered', { exact: true })).toBeVisible();
  await expect(page.getByText(/does not confirm payment/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(page.url()).not.toContain(orderId);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByText('Synthetic buyer')).toHaveCount(0);
});
test('order lookup hides restricted delivery and clears stale data on errors', async ({ page }) => {
  await mock(page);
  let status = 200;
  await page.route('**/api/operator/orders/*', route => route.fulfill({ status, json: status === 200 ? { ...savedOrder, delivery: null } : { error: { code: 'NOT_FOUND' } } }));
  await login(page); await code(page); await findOrder(page);
  await expect(page.getByText('Saved test chair')).toBeVisible();
  await expect(page.getByText(/restricted to the fulfilment role/)).toBeVisible();
  await expect(page.getByText('Synthetic buyer')).toHaveCount(0);
  for (const [value, message] of [[404, 'No order was found'], [503, 'Order lookup is unavailable'], [403, 'Access denied'], [401, 'Your session ended'], [429, 'Too many requests']]) {
    status = value; await findOrder(page);
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(page.getByText('Saved test chair')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Find order', exact: true })).toBeEnabled();
  }
});
test('order lookup validates IDs before sending a request and supports network retries', async ({ page }) => {
  await mock(page);
  let calls = 0;
  await page.route('**/api/operator/orders/*', route => { calls++; return route.abort(); });
  await login(page); await code(page);
  await page.getByLabel('Order ID', { exact: true }).fill('invalid');
  await page.getByRole('button', { name: 'Find order', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('valid order ID');
  expect(calls).toBe(0);
  await findOrder(page);
  await expect(page.getByRole('alert')).toContainText('Check your connection');
  expect(calls).toBe(1);
});
test('expiry removes loaded order and customer details', async ({ page }) => {
  await page.clock.install(); await mock(page);
  await page.route('**/api/operator/orders/*', route => route.fulfill({ json: savedOrder }));
  await login(page); await code(page); await findOrder(page);
  await expect(page.getByText('Synthetic buyer')).toBeVisible();
  await page.clock.fastForward(3601000);
  await expect(page.getByText(/Your session expired/)).toBeVisible();
  await expect(page.getByText('Synthetic buyer')).toHaveCount(0);
});

test('fulfilment confirms each transition and refreshes saved state', async ({ page }) => {
  await mock(page);
  let status = 'on_hold'; const writes = [];
  await page.route('**/api/operator/orders/**', async route => {
    if (route.request().method() === 'POST') {
      expect(route.request().headers().authorization).toMatch(/^Bearer /);
      const body = route.request().postDataJSON(); writes.push(body);
      status = body.target_status;
      return route.fulfill({ json: { order_id: orderId, status, replayed: false } });
    }
    return route.fulfill({ json: { ...savedOrder, status } });
  });
  await login(page); await code(page); await findOrder(page);
  for (const [label, value] of [['Allocated', 'allocated'], ['Despatched', 'despatched'], ['Delivered', 'delivered']]) {
    await page.getByRole('button', { name: `Mark ${label}`, exact: true }).click();
    expect(status).not.toBe(value);
    await page.getByRole('button', { name: `Confirm ${label}`, exact: true }).click();
    await expect(page.getByText('Order refreshed after the action.')).toBeVisible();
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  expect(writes).toEqual([{ target_status: 'allocated' }, { target_status: 'despatched' }, { target_status: 'delivered' }]);
  await expect(page.getByRole('region', { name: 'Order actions' })).toHaveCount(0);
});
test('cancellation can be dismissed and conflicts clear stale controls', async ({ page }) => {
  await mock(page); let calls = 0;
  await page.route('**/api/operator/orders/**', route => {
    if (route.request().method() === 'POST') {
      calls++; expect(route.request().url()).toContain('/cancel');
      expect(route.request().postDataJSON()).toEqual({});
      return route.fulfill({ status: 409, json: { error: { code: 'ORDER_CONFLICT' } } });
    }
    return route.fulfill({ json: { ...savedOrder, status: 'allocated' } });
  });
  await login(page); await code(page); await findOrder(page);
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Keep current status' }).click(); expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Cancelled' }).click();
  await expect(page.getByRole('alert')).toContainText('order changed'); expect(calls).toBe(1);
  await expect(page.getByText('Synthetic buyer')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Order actions' })).toHaveCount(0);
});
test('finance role cannot see fulfilment controls', async ({ page }) => {
  await mock(page);
  await page.route('**/api/operator/session', route => route.fulfill({ json: { operator_id: user.id, roles: ['finance'] } }));
  await page.route('**/api/operator/orders/*', route => route.fulfill({ json: { ...savedOrder, status: 'on_hold', delivery: null } }));
  await login(page); await code(page); await findOrder(page);
  await expect(page.getByText('Saved test chair')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Order actions' })).toHaveCount(0);
});

test('successful cancellation refreshes and removes further actions', async ({ page }) => {
  await mock(page); let status = 'on_hold';
  await page.route('**/api/operator/orders/**', route => {
    if (route.request().method() === 'POST') {
      status = 'cancelled'; return route.fulfill({ json: { order_id: orderId, status, replayed: false } });
    }
    return route.fulfill({ json: { ...savedOrder, status } });
  });
  await login(page); await code(page); await findOrder(page);
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm Cancelled' }).click();
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Order actions' })).toHaveCount(0);
});
test('lost action response requires lookup before another attempt', async ({ page }) => {
  await mock(page); let writes = 0;
  await page.route('**/api/operator/orders/**', route => {
    if (route.request().method() === 'POST') { writes++; return route.abort(); }
    return route.fulfill({ json: { ...savedOrder, status: 'on_hold' } });
  });
  await login(page); await code(page); await findOrder(page);
  await page.getByRole('button', { name: 'Mark Allocated' }).click();
  await page.getByRole('button', { name: 'Confirm Allocated' }).click();
  await expect(page.getByRole('alert')).toContainText('outcome is unknown');
  expect(writes).toBe(1);
  await expect(page.getByRole('region', { name: 'Order actions' })).toHaveCount(0);
  await expect(page.getByText('Synthetic buyer')).toHaveCount(0);
  await findOrder(page);
  await expect(page.getByRole('button', { name: 'Mark Allocated' })).toBeVisible();
});

const collectionId = '44444444-4444-4444-8444-444444444444';
async function financeOrder(page, overrides = {}, roles = ['finance']) {
  await mock(page);
  await page.route('**/api/operator/session', route => route.fulfill({ json: { operator_id: user.id, roles } }));
  await page.route('**/api/operator/orders/*', route => route.fulfill({ json: { ...savedOrder, delivery: null, ...overrides } }));
  await login(page); await code(page); await findOrder(page);
  await expect(page.getByText('Saved test chair')).toBeVisible();
}
async function reviewCollection(page) {
  await page.getByLabel('Receipt reference', { exact: true }).fill('cod-2026/001');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Review collection' }).click();
}
test('finance confirms full COD collection and clears receipt on sign-out', async ({ page }) => {
  let writes = 0;
  await financeOrder(page);
  await page.route('**/api/operator/orders/*/collections', route => {
    writes++;
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    const body = route.request().postDataJSON();
    expect(body).toEqual({ amount_minor: 2125, receipt_reference: 'COD-2026/001', idempotency_key: expect.stringMatching(/^[a-f0-9-]{36}$/) });
    return route.fulfill({ json: { order_id: orderId, collection_id: collectionId, replayed: false } });
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await reviewCollection(page); expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Edit receipt' }).click(); expect(writes).toBe(0);
  await reviewCollection(page);
  await page.getByRole('button', { name: 'Confirm collection' }).click();
  await expect(page.getByText('COD collection recorded.', { exact: true })).toBeVisible();
  expect(writes).toBe(1);
  await expect(page.getByRole('button', { name: 'Confirm collection' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  expect(page.url()).not.toContain('cod-2026');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByText(/Collection reference:/)).toHaveCount(0);
});
test('uncertain collection retries identical payload and accepts replay', async ({ page }) => {
  await financeOrder(page); const writes = [];
  await page.route('**/api/operator/orders/*/collections', route => {
    writes.push(route.request().postDataJSON());
    if (writes.length === 1) return route.abort();
    return route.fulfill({ json: { order_id: orderId, collection_id: collectionId, replayed: true } });
  });
  await reviewCollection(page); await page.getByRole('button', { name: 'Confirm collection' }).click();
  await expect(page.getByRole('alert')).toContainText('outcome is unconfirmed');
  await expect(page.getByRole('button', { name: 'Edit receipt' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry same collection' }).click();
  await expect(page.getByText('Previously recorded collection confirmed.')).toBeVisible();
  expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]);
});
for (const status of [401, 403, 409]) {
  test(`collection ${status} blocks further submission`, async ({ page }) => {
    await financeOrder(page);
    await page.route('**/api/operator/orders/*/collections', route => route.fulfill({ status, json: { error: { code: 'DENIED' } } }));
    await reviewCollection(page); await page.getByRole('button', { name: 'Confirm collection' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry same collection' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Confirm collection' })).toHaveCount(0);
  });
}
test('collection requires finance, delivered COD and PKR', async ({ page }) => {
  for (const [overrides, roles] of [[{}, ['fulfilment']], [{status:'allocated'}, ['finance']], [{payment_method:'online'}, ['finance']], [{currency:'IDR'}, ['finance']]]) {
    await financeOrder(page, overrides, roles);
    await expect(page.getByRole('heading', { name: 'Record COD collection' })).toHaveCount(0);
  }
});
test('collection validates receipt and expiry discards pending retry', async ({ page }) => {
  await page.clock.install(); await financeOrder(page);
  await page.getByLabel('Receipt reference', { exact: true }).fill('not a code');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Review collection' }).click();
  await expect(page.getByRole('alert')).toContainText('valid internal receipt');
  await expect(page.getByRole('button', { name: 'Confirm collection' })).toHaveCount(0);
  await reviewCollection(page);
  await page.clock.fastForward(3601000);
  await expect(page.getByText(/Your session expired/)).toBeVisible();
  await expect(page.getByText(/COD-2026/)).toHaveCount(0);
});

test('invalid acknowledgement and transient failures preserve collection retry', async ({ page }) => {
  await financeOrder(page); const writes = [];
  await page.route('**/api/operator/orders/*/collections', route => {
    writes.push(route.request().postDataJSON());
    const responses = [
      { json: { order_id: orderId, collection_id: 'invalid', replayed: false } },
      { status: 503, json: { error: { code: 'COMMERCE_UNAVAILABLE' } } },
      { status: 429, json: { error: { code: 'RATE_LIMITED' } } },
      { json: { order_id: orderId, collection_id: collectionId, replayed: true } },
    ];
    return route.fulfill(responses[writes.length - 1]);
  });
  await reviewCollection(page); await page.getByRole('button', { name: 'Confirm collection' }).click();
  for (const message of ['outcome is unconfirmed', 'outcome is unconfirmed', 'Too many requests']) {
    await expect(page.getByRole('alert')).toContainText(message);
    await page.getByRole('button', { name: 'Retry same collection' }).click();
  }
  await expect(page.getByText('Previously recorded collection confirmed.')).toBeVisible();
  expect(writes).toHaveLength(4);
  for (const body of writes) expect(body).toEqual(writes[0]);
});
