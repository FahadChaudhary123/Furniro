import { describe, expect, it } from 'vitest';
import { checkDeployment } from './deploymentSmoke.js';

const apiOrigin = 'https://furniro-api.onrender.com';
const storefrontOrigin = 'https://furniro-storefront.onrender.com';
const json = (body, headers = {}) => new Response(JSON.stringify(body), {
  headers: { 'content-type': 'application/json', ...headers },
});

function responses({ cors = storefrontOrigin, shopStatus = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, method: options?.method ?? 'GET' });
    if (url.endsWith('/health')) return json({ status: 'ok', env: 'production', build: { sha: 'abc123' } }, {
      'cache-control': 'no-store',
    });
    if (url.endsWith('/health/ready')) return json({ status: 'ready' });
    if (url.includes('/api/products')) {
      return json({ data: [{ slug: 'chair' }], meta: { total: 40 } }, {
        'access-control-allow-origin': cors,
        'cache-control': 'no-store',
      });
    }
    return new Response('<div id="root"></div><script type="module"></script>', {
      status: shopStatus, headers: { 'content-type': 'text/html' },
    });
  };
  return { fetchImpl, calls };
}

describe('deployment smoke', () => {
  it('checks a production API and the storefront deep link with GET requests only', async () => {
    const { fetchImpl, calls } = responses();
    await expect(checkDeployment({ apiOrigin, storefrontOrigin, fetchImpl })).resolves.toEqual({
      buildSha: 'abc123', publishedProducts: 40,
    });
    expect(calls).toHaveLength(4);
    expect(calls.every(({ method }) => method === 'GET')).toBe(true);
  });

  it('fails if the storefront origin is not allowed by the API', async () => {
    await expect(checkDeployment({ apiOrigin, storefrontOrigin,
      fetchImpl: responses({ cors: 'https://wrong.onrender.com' }).fetchImpl,
    })).rejects.toThrow('does not allow');
  });

  it('fails if a deep link is not rewritten to the app shell', async () => {
    await expect(checkDeployment({ apiOrigin, storefrontOrigin,
      fetchImpl: responses({ shopStatus: 404 }).fetchImpl,
    })).rejects.toThrow('/shop returned 404');
  });

  it('rejects local or placeholder targets before making a request', async () => {
    const { fetchImpl, calls } = responses();
    await expect(checkDeployment({ apiOrigin: 'http://localhost:3000', storefrontOrigin,
      fetchImpl,
    })).rejects.toThrow('HTTPS origin');
    expect(calls).toHaveLength(0);
  });
});
