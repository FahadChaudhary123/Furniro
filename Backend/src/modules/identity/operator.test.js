import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { createOperatorAuthenticator, operatorPublicConfig } from './index.js';
import { operatorFixture } from '../../../test/helpers/operatorAuth.js';

it('never publishes disabled, malformed or private authentication configuration', () => {
  const { settings } = operatorFixture();
  for (const change of [{ enabled: false }, { publishableKey: 'sb_secret_synthetic' }, { access: 'invalid' }, { url: 'http://example.test' }]) {
    expect(operatorPublicConfig({ ...settings, ...change })).toEqual({ enabled: false });
  }
  expect(Object.keys(operatorPublicConfig(settings)).sort()).toEqual(['enabled', 'publishable_key', 'url']);
});

it('verifies signed MFA tokens and obtains roles only from the server roster', async () => {
  const f = operatorFixture(['fulfilment']);
  const authenticate = createOperatorAuthenticator(f.settings, { fetchImpl: f.fetchImpl });
  expect(await authenticate(`Bearer ${f.token()}`)).toEqual({ id: f.actorId, roles: ['fulfilment'] });
  expect(f.calls).toContain(`${f.url}/auth/v1/user`);
});

it('rejects a forged signature even when claims name an allowed operator', async () => {
  const f = operatorFixture();
  const attacker = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
  await expect(createOperatorAuthenticator(f.settings, { fetchImpl: f.fetchImpl })(`Bearer ${f.token({}, attacker)}`))
    .rejects.toMatchObject({ status: 401 });
  expect(f.calls).not.toContain(`${f.url}/auth/v1/user`);
});

it('rejects expired tokens, wrong issuer/audience, service roles and future validity', async () => {
  const f = operatorFixture();
  const auth = createOperatorAuthenticator(f.settings, { fetchImpl: f.fetchImpl });
  for (const claims of [{ exp: 1 }, { exp: undefined }, { iss: 'https://attacker.test/auth/v1' },
    { aud: 'other' }, { role: 'service_role' }, { nbf: Math.floor(Date.now() / 1000) + 300 }, { is_anonymous: true }]) {
    await expect(auth(`Bearer ${f.token(claims)}`)).rejects.toMatchObject({ status: 401 });
  }
});

it('requires MFA and rejects users absent from the server roster despite user metadata', async () => {
  const f = operatorFixture();
  const auth = createOperatorAuthenticator(f.settings, { fetchImpl: f.fetchImpl });
  await expect(auth(`Bearer ${f.token({ aal: 'aal1' })}`)).rejects.toMatchObject({ status: 403, code: 'MFA_REQUIRED' });
  await expect(auth(`Bearer ${f.token({ sub: randomUUID() })}`)).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
});

it('denies missing or malformed bearer headers without calling Auth', async () => {
  const f = operatorFixture();
  const auth = createOperatorAuthenticator(f.settings, { fetchImpl: f.fetchImpl });
  for (const header of [undefined, '', 'Basic password', 'Bearer junk', `Bearer ${'a'.repeat(8200)}`]) {
    await expect(auth(header)).rejects.toMatchObject({ status: 401 });
  }
  expect(f.calls).toHaveLength(0);
});

it('fails closed for disabled or malformed configuration without using legacy credentials', async () => {
  const f = operatorFixture();
  for (const changes of [{ enabled: false }, { url: 'http://insecure.test' }, { publishableKey: 'service_role' },
    { access: 'not-json' }, { access: { [f.actorId]: ['admin'] } }, { access: { '*': ['finance'] } }]) {
    await expect(createOperatorAuthenticator({ ...f.settings, ...changes }, { fetchImpl: f.fetchImpl })(`Bearer ${f.token()}`))
      .rejects.toMatchObject({ status: 503 });
  }
  expect(f.calls).toHaveLength(0);
});

it('rejects removed users and redacts provider failures', async () => {
  const f = operatorFixture();
  for (const [status, expected] of [[401, 401], [500, 503]]) {
    const fetchImpl = (url, init) => String(url).endsWith('/user')
      ? new Response(JSON.stringify({ msg: 'private-provider-data' }), { status, headers: { 'content-type': 'application/json' } })
      : f.fetchImpl(url, init);
    try { await createOperatorAuthenticator(f.settings, { fetchImpl })(`Bearer ${f.token()}`); throw new Error('Expected failure'); }
    catch (error) {
      expect(error.status).toBe(expected);
      expect(error.message).not.toContain('private-provider-data');
    }
  }
});

it('does not leak thrown transport errors through the Auth SDK logging', async () => {
  const f = operatorFixture();
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const auth = createOperatorAuthenticator(f.settings, { fetchImpl: async () => { throw new Error('private-transport-context'); } });
    await expect(auth(`Bearer ${f.token()}`)).rejects.toMatchObject({ status: 503 });
    expect(JSON.stringify(log.mock.calls)).not.toContain('private-transport-context');
  } finally { log.mockRestore(); }
});
