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
