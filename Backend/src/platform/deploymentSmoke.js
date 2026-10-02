/** Read-only verification of a deployed storefront and API. */
export async function checkDeployment({ apiOrigin, storefrontOrigin, fetchImpl = fetch }) {
  for (const [name, value] of Object.entries({ apiOrigin, storefrontOrigin })) {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${name} must be an HTTPS origin`);
    }
    if (url.protocol !== 'https:' || url.origin !== value ||
        url.hostname === 'localhost' || url.hostname.endsWith('.example.com')) {
      throw new Error(`${name} must be an exact public HTTPS origin`);
    }
  }

  const request = async (url, options) => {
    const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`${new URL(url).pathname} returned ${response.status}`);
    return response;
  };

  const healthResponse = await request(`${apiOrigin}/health`);
  if (healthResponse.headers.get('cache-control') !== 'no-store') {
    throw new Error('/health can be cached');
  }
  const health = await healthResponse.json();
  if (health.status !== 'ok' || health.env !== 'production' ||
      !health.build?.sha || health.build.sha === 'unknown') {
    throw new Error('/health is not a traceable production build');
  }

  const ready = await (await request(`${apiOrigin}/health/ready`)).json();
  if (ready.status !== 'ready') throw new Error('/health/ready did not report ready');

  const productsResponse = await request(`${apiOrigin}/api/products?limit=1`, {
    headers: { Origin: storefrontOrigin },
  });
  if (productsResponse.headers.get('cache-control') !== 'no-store') {
    throw new Error('/api/products can be cached');
  }
  if (productsResponse.headers.get('access-control-allow-origin') !== storefrontOrigin) {
    throw new Error('The API does not allow the storefront origin');
  }
  const products = await productsResponse.json();
  if (!Array.isArray(products.data) || products.data.length !== 1 ||
      !Number.isInteger(products.meta?.total) || products.meta.total < 1) {
    throw new Error('/api/products did not return a published product');
  }

  const shop = await request(`${storefrontOrigin}/shop`);
  if (shop.redirected) throw new Error('/shop redirected instead of serving the app shell');
  if (!shop.headers.get('content-type')?.includes('text/html')) {
    throw new Error('/shop did not return HTML');
  }
  const html = await shop.text();
  if (!html.includes('id="root"') || !html.includes('type="module"')) {
    throw new Error('/shop did not return the storefront app shell');
  }

  return { buildSha: health.build.sha, publishedProducts: products.meta.total };
}
