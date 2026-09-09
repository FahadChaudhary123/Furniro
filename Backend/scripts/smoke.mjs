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

// Load .env so this targets the port the server actually binds to. Without it the smoke
// test defaulted to 3000 while a .env-configured server was on 5000, and the documented
// setup steps failed for anyone who had ever set PORT.
import 'dotenv/config';

const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;

/**
 * The origin the server is configured to allow. Read from the same source the server uses
 * rather than hardcoded — asserting a fixed 5173 made this fail against any server whose
 * allowlist had been set, which is a test bug reported as a CORS bug.
 */
const ALLOWED_ORIGIN =
  (process.env.ALLOWED_ORIGINS ?? '').split(',')[0].trim() || 'http://localhost:5173';

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

  const goodOrigin = await fetch(`${BASE}/health`, { headers: { Origin: ALLOWED_ORIGIN } });
  check(
    'allowed CORS origin is reflected',
    goodOrigin.headers.get('access-control-allow-origin') === ALLOWED_ORIGIN,
    `expected ${ALLOWED_ORIGIN}; set ALLOWED_ORIGINS to match the server under test`,
  );

  // --- security headers (SEC-04) ----------------------------------------------------------
  const secured = await fetch(`${BASE}/api/categories`);
  const h = (n) => secured.headers.get(n);
  check('sets Content-Security-Policy', (h('content-security-policy') ?? '').includes("default-src 'none'"));
  check('sets X-Content-Type-Options', h('x-content-type-options') === 'nosniff');
  check('sets X-Frame-Options', h('x-frame-options') === 'DENY');
  check('sets Referrer-Policy', h('referrer-policy') === 'no-referrer');
  check(
    'Cross-Origin-Resource-Policy allows the storefront',
    h('cross-origin-resource-policy') === 'cross-origin',
    'helmet defaults this to same-origin, which silently breaks the front end despite correct CORS',
  );

  // --- rate limiting (SEC-03) -------------------------------------------------------------
  check('advertises a rate-limit policy', Boolean(h('ratelimit-policy')));
  const first = await fetch(`${BASE}/api/categories`);
  const second = await fetch(`${BASE}/api/categories`);
  const remaining = (r) => Number(/remaining=(\d+)/.exec(r.headers.get('ratelimit') ?? '')?.[1]);
  check(
    'the remaining budget decreases',
    remaining(second) < remaining(first),
    `${remaining(first)} -> ${remaining(second)}`,
  );

  const healthProbe = await fetch(`${BASE}/health`);
  check(
    'health probes are exempt from rate limiting',
    !healthProbe.headers.get('ratelimit'),
    'a throttled health check reads as an outage and can trigger a restart loop',
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

  // CAT-08. A slug that never existed must stay a 404 — never a 410 with a redirect.
  // Soft-redirecting every typo to a plausible product hides broken links from the very
  // check that exists to find them, and sends visitors somewhere they did not ask for.
  const goneBody = await gone.json();
  check(
    'a slug that never existed carries no redirect',
    goneBody.error?.code === 'NOT_FOUND' && goneBody.error?.redirect_to === undefined,
    `got ${goneBody.error?.code}, redirect_to=${goneBody.error?.redirect_to}`,
  );

  const cats = await (await fetch(`${BASE}/api/categories`)).json();
  check('categories returns 7', cats.data?.length === 7, `got ${cats.data?.length}`);
  check('categories carry product_count',
    cats.data?.every((c) => Number.isInteger(c.product_count)));
  check('product_count sums to the catalogue',
    cats.data?.reduce((n, c) => n + c.product_count, 0) === 40);

  // --- catalogue: batch slug lookup (the cart's hydration path) ---------------------------
  const batch = await (await fetch(`${BASE}/api/products?slugs=syltherine,lolito,potty&limit=100`)).json();
  check('batch slug lookup returns just those products', batch.meta?.total === 3, `got ${batch.meta?.total}`);
  check(
    'batch returns the requested slugs',
    ['syltherine', 'lolito', 'potty'].every((s) => batch.data.some((p) => p.slug === s)),
  );

  const partial = await (await fetch(`${BASE}/api/products?slugs=syltherine,not-a-product`)).json();
  check('an unknown slug is absent rather than an error', partial.meta?.total === 1);

  const tooMany = await fetch(
    `${BASE}/api/products?slugs=${Array.from({ length: 51 }, (_, i) => `s${i}`).join(',')}`,
  );
  check('rejects more slugs than the cap', tooMany.status === 400, `got ${tooMany.status}`);

  // --- content: posts ---------------------------------------------------------------------
  const posts = await fetch(`${BASE}/api/posts`);
  const postsBody = await posts.json();
  check('GET /api/posts returns 200', posts.status === 200, `got ${posts.status}`);
  check('returns { data, meta }', Array.isArray(postsBody.data) && !!postsBody.meta);
  check('defaults to 3 per page', postsBody.data.length === 3, `got ${postsBody.data?.length}`);
  check(
    'sorted newest first',
    new Date(postsBody.data[0].published_at) >= new Date(postsBody.data.at(-1).published_at),
  );
  check(
    'published_at is a real date, not a display string',
    !Number.isNaN(Date.parse(postsBody.data[0].published_at)),
  );
  check('posts carry a slug', typeof postsBody.data[0].slug === 'string');

  const recent = await (await fetch(`${BASE}/api/posts/recent`)).json();
  check('recent posts omit the body', !('body' in (recent.data?.[0] ?? {})));

  const tags = await (await fetch(`${BASE}/api/posts/tags`)).json();
  check('tags carry counts', tags.data?.every((t) => Number.isInteger(t.count)));
  check(
    'tag counts sum to the post count',
    tags.data?.reduce((n, t) => n + t.count, 0) === postsBody.meta.total,
  );

  const onePost = await fetch(`${BASE}/api/posts/${postsBody.data[0].slug}`);
  const onePostBody = await onePost.json();
  check('single post returns 200', onePost.status === 200, `got ${onePost.status}`);
  check('single post is returned bare with a body', !!onePostBody.body && !onePostBody.data);

  const missingPost = await fetch(`${BASE}/api/posts/no-such-post`);
  check('unknown post slug returns 404', missingPost.status === 404, `got ${missingPost.status}`);

  const badTag = await fetch(`${BASE}/api/posts?tag=nonsense`);
  check('rejects an unknown tag', badTag.status === 400, `got ${badTag.status}`);

  const badPostLimit = await fetch(`${BASE}/api/posts?limit=9999`);
  check('rejects a post limit above the cap', badPostLimit.status === 400, `got ${badPostLimit.status}`);

  // --- search (SRCH-05, SRCH-06) ------------------------------------------------------------
  const noResults = await fetch(`${BASE}/api/products?q=zzzznotathing`);
  const noResultsBody = await noResults.json();
  check('a search with no matches is a 200, not a 404', noResults.status === 200);
  check(
    'it returns an empty list with a total of 0, not an error',
    Array.isArray(noResultsBody.data) &&
      noResultsBody.data.length === 0 &&
      noResultsBody.meta?.total === 0,
  );
  // The client needs total_pages >= 1 to render "page 1 of 1" rather than "page 1 of 0".
  check('total_pages stays at least 1', noResultsBody.meta?.total_pages === 1);

  // --- client error reporting (PLAT-04) ---------------------------------------------------
  const post = (body) =>
    fetch(`${BASE}/api/client-errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

  const reported = await post(JSON.stringify({ kind: 'render', message: 'smoke test error' }));

  // This section spends six of the endpoint's hourly budget. Running smoke repeatedly can
  // exhaust it, and four cryptic failures are a worse diagnostic than one clear sentence.
  if (reported.status === 429) {
    console.error('\n  Client error reports are rate limited — this suite has run too often');
    console.error('  in the last hour. Restart the server, or raise the limit:');
    console.error('    RATE_LIMIT_CLIENT_ERROR_MAX=500 npm run dev\n');
  }

  check('accepts a client error report', reported.status === 204, `got ${reported.status}`);
  check('returns no body — nothing submitted is ever echoed back', (await reported.text()) === '');

  const noMessage = await post(JSON.stringify({ kind: 'render' }));
  check('a report with no message is dropped, not rejected', noMessage.status === 204);

  // A malformed body is the CLIENT's mistake. Returning 500 reports it as a server fault
  // and poisons the very error signal this endpoint exists to produce — a scanner posting
  // garbage would look like the API falling over.
  const malformed = await post('{bad json');
  check('malformed JSON is a 400, not a 500', malformed.status === 400, `got ${malformed.status}`);

  const malformedBody = await malformed.json();
  check(
    'a malformed body returns the documented error shape',
    malformedBody.error?.code === 'INVALID_BODY' && Boolean(malformedBody.error?.correlationId),
  );
  check(
    'a malformed body does not echo the input back',
    !JSON.stringify(malformedBody).includes('bad json'),
  );

  const oversized = await post(JSON.stringify({ message: 'A'.repeat(200_000) }));
  check('an oversized body is a 413, not a 500', oversized.status === 413, `got ${oversized.status}`);

  const wrongMethod = await fetch(`${BASE}/api/client-errors`);
  check(
    'GET is not accepted on the report endpoint',
    wrongMethod.status === 404,
    `got ${wrongMethod.status}`,
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`\nSmoke test could not run: ${err.message}`);
  console.error('Is the server running? `npm start` in Backend/\n');
  process.exit(1);
});
