#!/usr/bin/env node
/**
 * Platform smoke test — verifies the running server, not the source.
 *
 * There is no test framework yet (docs/OPS_CONFORMANCE.md tracks that gap). This is the
 * minimum that proves the platform module actually behaves: health, correlation, error
 * shape, CORS allowlist. Doc B §7 R1 verifies recovery "by a real test order end to end";
 * this is the same idea at the platform's scale.
 *
 *   npm start          # in one shell
 *   npm run smoke      # in another
 *
 * Override the target with BASE_URL.
 */

const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ok    ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  console.log(`\nPlatform smoke test against ${BASE}\n`);

  // --- liveness -----------------------------------------------------------------------
  const health = await fetch(`${BASE}/health`);
  const healthBody = await health.json();
  check('GET /health returns 200', health.status === 200, `got ${health.status}`);
  check('reports status ok', healthBody.status === 'ok');
  check('reports build sha', typeof healthBody.build?.sha === 'string');
  check('reports feature flags', typeof healthBody.flags === 'object');
  check('reports uptime', typeof healthBody.uptimeSeconds === 'number');
  check(
    'leaks no credentials',
    !JSON.stringify(healthBody).match(/supabase\.co|postgres|key|secret|password/i),
  );

  // --- readiness ----------------------------------------------------------------------
  const ready = await fetch(`${BASE}/health/ready`);
  check('GET /health/ready responds', [200, 503].includes(ready.status), `got ${ready.status}`);

  // --- correlation --------------------------------------------------------------------
  check('generates a correlation id', Boolean(health.headers.get('x-correlation-id')));

  const supplied = 'smoke-test-correlation-1';
  const echoed = await fetch(`${BASE}/health`, { headers: { 'X-Correlation-Id': supplied } });
  check('echoes a valid supplied id', echoed.headers.get('x-correlation-id') === supplied);

  const rejected = await fetch(`${BASE}/health`, { headers: { 'X-Correlation-Id': 'bad id!!' } });
  check(
    'replaces a malformed supplied id',
    rejected.headers.get('x-correlation-id') !== 'bad id!!',
  );

  // --- errors -------------------------------------------------------------------------
  const missing = await fetch(`${BASE}/no-such-route`);
  const missingBody = await missing.json();
  check('unknown route returns 404', missing.status === 404, `got ${missing.status}`);
  check('error uses the documented shape', missingBody.error?.code === 'NOT_FOUND');
  check('error carries a correlation id', Boolean(missingBody.error?.correlationId));
  check('error exposes no stack', !('debug' in (missingBody.error ?? {})) || missing.status < 500);

  // --- hardening ----------------------------------------------------------------------
  check('does not advertise the framework', !health.headers.get('x-powered-by'));

  const badOrigin = await fetch(`${BASE}/health`, { headers: { Origin: 'https://evil.example' } });
  check(
    'disallowed CORS origin is not reflected',
    badOrigin.headers.get('access-control-allow-origin') !== 'https://evil.example',
  );

  const goodOrigin = await fetch(`${BASE}/health`, {
    headers: { Origin: 'http://localhost:5173' },
  });
  check(
    'allowed CORS origin is reflected',
    goodOrigin.headers.get('access-control-allow-origin') === 'http://localhost:5173',
  );

  // --- catalogue: list ------------------------------------------------------------------
  const list = await fetch(`${BASE}/api/products`);
  const listBody = await list.json();
  check('GET /api/products returns 200', list.status === 200, `got ${list.status}`);
  check('returns { data, meta }', Array.isArray(listBody.data) && !!listBody.meta);
  check('defaults to 16 per page', listBody.data.length === 16, `got ${listBody.data?.length}`);
  check('reports the full total', listBody.meta?.total === 40, `got ${listBody.meta?.total}`);
  check('computes total_pages', listBody.meta?.total_pages === 3, `got ${listBody.meta?.total_pages}`);

  const item = listBody.data[0];
  check('item has a slug', typeof item?.slug === 'string');
  check('price is an integer, not a string', Number.isInteger(item?.price));
  check('category is embedded as an object', typeof item?.category === 'object' && !!item.category?.slug);
  check('no stored badge field', !('badge' in (item ?? {})));

  // --- catalogue: paging, sorting, filtering ---------------------------------------------
  const page3 = await (await fetch(`${BASE}/api/products?page=3`)).json();
  check('last page returns the remainder', page3.data.length === 8, `got ${page3.data.length}`);

  const asc = await (await fetch(`${BASE}/api/products?sort=price:asc&limit=100`)).json();
  const prices = asc.data.map((p) => p.price);
  check('sort=price:asc is ascending', prices.every((v, i) => i === 0 || prices[i - 1] <= v));

  const desc = await (await fetch(`${BASE}/api/products?sort=price:desc&limit=100`)).json();
  check('sort=price:desc reverses it', desc.data[0].price === asc.data.at(-1).price);

  const filtered = await (await fetch(`${BASE}/api/products?category=living-room&limit=100`)).json();
  check('category filter works', filtered.data.length === 12, `got ${filtered.data.length}`);
  check('filter returns only that category',
    filtered.data.every((p) => p.category.slug === 'living-room'));

  const searched = await (await fetch(`${BASE}/api/products?q=sofa&limit=100`)).json();
  check('search matches name or description', searched.data.length > 0 &&
    searched.data.every((p) => `${p.name} ${p.description}`.toLowerCase().includes('sofa')));

  const ranged = await (await fetch(`${BASE}/api/products?min_price=100000000&max_price=300000000&limit=100`)).json();
  check('price range filters', ranged.data.every((p) => p.price >= 100000000 && p.price <= 300000000));

  // --- catalogue: validation -------------------------------------------------------------
  const badSort = await fetch(`${BASE}/api/products?sort=price;DROP TABLE products`);
  const badSortBody = await badSort.json();
  check('rejects a sort outside the whitelist', badSort.status === 400, `got ${badSort.status}`);
  check('validation error names the field',
    badSortBody.error?.details?.some((d) => d.field === 'sort'));

  const badPage = await fetch(`${BASE}/api/products?page=-1`);
  check('rejects a negative page', badPage.status === 400, `got ${badPage.status}`);

  const overLimit = await fetch(`${BASE}/api/products?limit=9999`);
  check('rejects limit above the cap', overLimit.status === 400, `got ${overLimit.status}`);

  const badCategory = await fetch(`${BASE}/api/products?category=nonsense`);
  check('rejects an unknown category', badCategory.status === 400, `got ${badCategory.status}`);

  // --- catalogue: featured, single, categories -------------------------------------------
  const featured = await (await fetch(`${BASE}/api/products/featured`)).json();
  check('featured returns 8 curated products', featured.data?.length === 8, `got ${featured.data?.length}`);
  check('featured is in curated order', featured.data?.[0]?.slug === 'syltherine');

  const one = await fetch(`${BASE}/api/products/syltherine`);
  const oneBody = await one.json();
  check('single product returns 200', one.status === 200, `got ${one.status}`);
  check('single product is returned bare', oneBody.slug === 'syltherine' && !oneBody.data);

  const gone = await fetch(`${BASE}/api/products/does-not-exist`);
  check('unknown slug returns 404', gone.status === 404, `got ${gone.status}`);

  const cats = await (await fetch(`${BASE}/api/categories`)).json();
  check('categories returns 7', cats.data?.length === 7, `got ${cats.data?.length}`);
  check('categories carry product_count',
    cats.data?.every((c) => Number.isInteger(c.product_count)));
  check('product_count sums to the catalogue',
    cats.data?.reduce((n, c) => n + c.product_count, 0) === 40);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\nSmoke test could not run: ${err.message}`);
  console.error('Is the server running? `npm start` in Backend/\n');
  process.exit(1);
});
