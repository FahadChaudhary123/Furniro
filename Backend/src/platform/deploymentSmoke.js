/** Read-only verification of a deployed storefront and API. */
export async function checkDeployment({ apiOrigin, storefrontOrigin, redirects = [], fetchImpl = fetch }) {
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
  if (!shop.headers.get('cache-control')?.includes('no-cache')) {
    throw new Error('/shop HTML does not revalidate');
  }
  const csp = shop.headers.get('content-security-policy') ?? '';
  if (!csp.includes("script-src 'self'") || !csp.includes("frame-ancestors 'none'")) {
    throw new Error('/shop is missing the storefront CSP');
  }
  if (shop.headers.get('x-content-type-options') !== 'nosniff' ||
      shop.headers.get('x-frame-options') !== 'DENY' ||
      shop.headers.get('referrer-policy') !== 'no-referrer' ||
      !shop.headers.get('strict-transport-security')?.includes('max-age=31536000')) {
    throw new Error('/shop is missing a storefront security header');
  }
  const html = await shop.text();
  if (!html.includes('id="root"') || !html.includes('type="module"')) {
    throw new Error('/shop did not return the storefront app shell');
  }
  const assetPath = html.match(/<script\b[^>]*\bsrc="(\/assets\/[^\"]+\.js)"[^>]*>/)?.[1];
  if (!assetPath) throw new Error('/shop has no fingerprinted entry script');
  const asset = await request(`${storefrontOrigin}${assetPath}`);
  const cache = asset.headers.get('cache-control') ?? '';
  if (!cache.includes('immutable') || !cache.includes('max-age=31536000')) {
    throw new Error('Fingerprinted entry script is not cached immutably');
  }

  const sitemapResponse = await request(`${storefrontOrigin}/sitemap.xml`);
  if (sitemapResponse.redirected) throw new Error('/sitemap.xml redirected');
  const sitemap = await sitemapResponse.text();
  if (!sitemap.includes('<urlset') || !sitemap.includes('</urlset>')) {
    throw new Error('/sitemap.xml is not a sitemap');
  }
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc);
  if (locations.length === 0 || new Set(locations).size !== locations.length ||
      locations.some((loc) => {
        try { return new URL(loc).origin !== storefrontOrigin; } catch { return true; }
      })) {
    throw new Error('/sitemap.xml has missing, duplicate or wrong-origin URLs');
  }
  const productLocations = locations.filter((loc) => new URL(loc).pathname.startsWith('/shop/'));
  if (!locations.includes(`${storefrontOrigin}/`) ||
      !locations.includes(`${storefrontOrigin}/shop/${products.data[0].slug}`) ||
      productLocations.length !== products.meta.total) {
    throw new Error('/sitemap.xml does not match the published catalogue');
  }

  const robotsResponse = await request(`${storefrontOrigin}/robots.txt`);
  if (robotsResponse.redirected) throw new Error('/robots.txt redirected');
  const robots = await robotsResponse.text();
  if (!robots.split(/\r?\n/).includes(`Sitemap: ${storefrontOrigin}/sitemap.xml`)) {
    throw new Error('/robots.txt advertises the wrong sitemap origin');
  }

  // Fetch without following: a final 200 from the SPA cannot prove that Render sent a 301.
  for (const { from, to } of redirects) {
    const source = `${storefrontOrigin}${from}`;
    const response = await fetchImpl(source, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    const location = response.headers.get('location');
    const expected = new URL(to, storefrontOrigin).href;
    const actual = location ? new URL(location, source).href : null;
    if (response.status !== 301 || actual !== expected) {
      throw new Error(`${from} must return 301 to ${to}; got ${response.status} to ${location ?? '(none)'}`);
    }
  }

  return { buildSha: health.build.sha, publishedProducts: products.meta.total,
    redirectsChecked: redirects.length };
}
