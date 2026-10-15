import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';

/** Real JWT signatures and a local-only Auth transport; never contacts an account. */
export function operatorFixture(roles = ['fulfilment', 'finance']) {
  const actorId = randomUUID();
  const url = `https://${randomUUID()}.example.test`;
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const kid = randomUUID();
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid, alg: 'ES256', use: 'sig' };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  function token(changes = {}, key = privateKey) {
    const payload = { sub: actorId, iss: `${url}/auth/v1`, aud: 'authenticated', role: 'authenticated',
      aal: 'aal2', exp: Math.floor(Date.now() / 1000) + 300, ...changes };
    const unsigned = `${encode({ alg: 'ES256', typ: 'JWT', kid })}.${encode(payload)}`;
    return `${unsigned}.${sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  }
  const calls = [];
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fetchImpl = async (target, init) => {
    calls.push(String(target));
    if (String(target) === `${url}/auth/v1/.well-known/jwks.json`) return json({ keys: [jwk] });
    if (String(target) === `${url}/auth/v1/user`) {
      const jwt = new Headers(init.headers).get('authorization').slice(7);
      const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
      return json({ id: claims.sub, is_anonymous: false, user_metadata: { roles: ['finance', 'fulfilment'] } });
    }
    throw new Error('Unexpected Auth transport request');
  };
  return { actorId, url, token, fetchImpl, calls,
    settings: { enabled: true, url, publishableKey: 'sb_publishable_synthetic_test', access: { [actorId]: roles } } };
}
