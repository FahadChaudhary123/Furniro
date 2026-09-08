/**
 * Catalogue API latency benchmark — `NFR-04`.
 *
 * Doc B §5 sets a p95 of 400 ms for the catalogue API.
 *
 * READ THIS BEFORE QUOTING A NUMBER FROM IT. This measures a local server reading an
 * in-memory array over loopback. It is not the SLO and it cannot be: production latency is
 * dominated by a database round trip, a network hop and a cold Lambda, none of which exist
 * here. Expect single-digit milliseconds, and do not report that as "we meet the SLO".
 *
 * What it IS good for, and why it is worth having now:
 *
 *   1. It measures the application's own contribution to latency — the part that is ours
 *      rather than the infrastructure's, and the only part currently under our control.
 *   2. It catches an algorithmic regression. Filtering, sorting and paging run over every
 *      product on every request; an accidental O(n²) in the service layer is invisible at
 *      40 products and fatal at 40,000. The scale check below is the guard.
 *   3. It is the harness. When a database lands, the same script measures the real thing.
 *
 * The budget is therefore deliberately far tighter than 400 ms: at this scale, anything
 * near the SLO would mean something is badly wrong long before the database is involved.
 *
 *   npm run latency               measure and enforce the local budget
 *   npm run latency -- --json     machine-readable
 *   npm run latency -- --slo      report against Doc B's 400 ms instead of the local budget
 */

import 'dotenv/config';

const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const againstSlo = args.has('--slo');

/** Doc B §5. What production must meet. */
const SLO_P95_MS = 400;

/**
 * Local budget. A loopback request to an in-memory store that takes 50 ms has a problem
 * that no amount of infrastructure will fix.
 */
const LOCAL_P95_MS = 50;

const REQUESTS = 200;
const WARMUP = 20;

const ENDPOINTS = [
  { name: 'products (default page)', path: '/api/products' },
  { name: 'products (max page size)', path: '/api/products?limit=100' },
  { name: 'products (filtered + sorted)', path: '/api/products?category=living-room&sort=price:desc' },
  { name: 'products (search)', path: '/api/products?q=chair' },
  { name: 'products (batch by slug)', path: '/api/products?slugs=syltherine,lolito,muggo,grifo' },
  { name: 'product by slug', path: '/api/products/syltherine' },
  { name: 'featured', path: '/api/products/featured' },
  { name: 'categories', path: '/api/categories' },
  { name: 'posts', path: '/api/posts' },
  { name: 'post by slug', path: '/api/posts/going-all-in-with-millennial-design' },
  { name: 'health', path: '/health' },
];

/** Total requests the whole run will send — used to size the rate-limit advice. */
const TOTAL_REQUESTS = (REQUESTS + WARMUP) * ENDPOINTS.length;

/**
 * Percentile by nearest-rank on a sorted sample.
 *
 * Deliberately not an average. An average hides the tail, and the tail is what a customer
 * experiences on the request that makes them leave.
 */
const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];

async function measure(path) {
  // Warm up first. The first request through a route pays for JIT and route matching, and
  // including it makes p99 a measure of Node starting up rather than of the endpoint.
  for (let i = 0; i < WARMUP; i += 1) await fetch(`${BASE}${path}`);

  const samples = [];
  let failures = 0;

  for (let i = 0; i < REQUESTS; i += 1) {
    const started = performance.now();
    const response = await fetch(`${BASE}${path}`);
    // Read the body. Stopping the clock before the response is consumed measures time to
    // first byte and calls it latency.
    await response.arrayBuffer();
    samples.push(performance.now() - started);

    // A 429 is not a slow response, it is a refused one — and it is fast, so including it
    // makes the numbers look BETTER while measuring nothing. This benchmark sends far more
    // requests than any real client, so it trips the API's own limiter; that is the limiter
    // working. Stop rather than report a fast average of rejections.
    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after');
      console.error(`\nRate limited after ${i} requests to ${path}.`);
      console.error(
        'This benchmark sends more requests than the API allows, so it throttles itself.',
      );
      console.error('Start the server with a limit above the run size, then re-run:');
      console.error(`  RATE_LIMIT_MAX=${TOTAL_REQUESTS + 500} npm run dev`);
      if (retryAfter) console.error(`(the current window resets in ${retryAfter}s)`);
      process.exit(2);
    }

    if (!response.ok) failures += 1;
  }

  samples.sort((a, b) => a - b);
  return {
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
    p99: percentile(samples, 99),
    max: samples[samples.length - 1],
    failures,
  };
}

/** Confirm the server is up before reporting a wall of zeroes. */
try {
  const probe = await fetch(`${BASE}/health`);
  if (!probe.ok) throw new Error(`health returned ${probe.status}`);
} catch (error) {
  console.error(`Cannot reach ${BASE} — ${error.message}`);
  console.error('Start the API first (`npm run dev`), or set BASE_URL.');
  process.exit(1);
}

/**
 * Check every URL answers 2xx before timing anything.
 *
 * A mistyped query parameter returns a fast 400 and would be reported as excellent latency.
 * That happened while writing this: `sort=price_desc` instead of `sort=price:desc` produced
 * a benchmark that measured the validation error path and passed its budget comfortably.
 */
const badUrls = [];
for (const endpoint of ENDPOINTS) {
  const response = await fetch(`${BASE}${endpoint.path}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.error?.details?.map((d) => `${d.field}: ${d.issue}`).join('; ');
    badUrls.push(`${endpoint.path} -> ${response.status}${detail ? ` (${detail})` : ''}`);
  }
}
if (badUrls.length > 0) {
  console.error('\nThese benchmark URLs do not return 2xx, so timing them would measure');
  console.error('the error path rather than the endpoint:\n');
  for (const url of badUrls) console.error(`  ${url}`);
  console.error('\nFix the URL in ENDPOINTS, or the endpoint.');
  process.exit(1);
}

const budget = againstSlo ? SLO_P95_MS : LOCAL_P95_MS;
const results = [];

for (const endpoint of ENDPOINTS) {
  results.push({ ...endpoint, ...(await measure(endpoint.path)) });
}

/**
 * Scale check: does the largest page cost dramatically more per item than the default one?
 * A linear service stays roughly flat per item; a quadratic one does not.
 */
const defaultPage = results.find((r) => r.name === 'products (default page)');
const maxPage = results.find((r) => r.name === 'products (max page size)');
const scaleFactor = maxPage && defaultPage ? maxPage.p95 / Math.max(defaultPage.p95, 0.001) : null;
const SCALE_LIMIT = 10;

const ms = (n) => `${n.toFixed(2)} ms`;

if (asJson) {
  console.log(
    JSON.stringify(
      {
        base: BASE,
        requests_per_endpoint: REQUESTS,
        budget_p95_ms: budget,
        budget_kind: againstSlo ? 'Doc B §5 SLO' : 'local (in-memory store, loopback)',
        slo_p95_ms: SLO_P95_MS,
        scale_factor: scaleFactor,
        endpoints: results,
      },
      null,
      2,
    ),
  );
} else {
  console.log(`\nCatalogue API latency  (NFR-04)`);
  console.log('='.repeat(74));
  console.log(`  target      ${BASE}`);
  console.log(`  sample      ${REQUESTS} requests per endpoint, after ${WARMUP} warm-up`);
  console.log(
    `  budget      p95 <= ${budget} ms  (${againstSlo ? "Doc B §5 SLO" : 'local: in-memory store over loopback'})`,
  );
  console.log('');
  console.log(`  ${'endpoint'.padEnd(32)}${'p50'.padStart(10)}${'p95'.padStart(10)}${'p99'.padStart(10)}${'max'.padStart(10)}`);
  console.log('  ' + '-'.repeat(72));

  for (const r of results) {
    const over = r.p95 > budget ? '  OVER' : '';
    console.log(
      `  ${r.name.padEnd(32)}${ms(r.p50).padStart(10)}${ms(r.p95).padStart(10)}${ms(r.p99).padStart(10)}${ms(r.max).padStart(10)}${over}`,
    );
  }

  if (scaleFactor !== null) {
    console.log('');
    console.log(
      `  100 products cost ${scaleFactor.toFixed(1)}x the default page (limit ${SCALE_LIMIT}x) — ` +
        (scaleFactor <= SCALE_LIMIT ? 'scales linearly' : 'SUPERLINEAR, investigate'),
    );
  }

  if (!againstSlo) {
    console.log('');
    console.log(`  Doc B §5 asks for p95 <= ${SLO_P95_MS} ms in production. This is a local`);
    console.log(`  measurement against an in-memory store and does NOT demonstrate that.`);
  }
  console.log('');
}

const breaches = results.filter((r) => r.p95 > budget);
const failed = results.filter((r) => r.failures > 0);

if (failed.length > 0) {
  console.error(`Non-2xx responses from: ${failed.map((r) => r.name).join(', ')}`);
}
if (breaches.length > 0) {
  console.error(`Over the ${budget} ms p95 budget: ${breaches.map((r) => r.name).join(', ')}`);
}
if (scaleFactor !== null && scaleFactor > SCALE_LIMIT) {
  console.error(`Latency scales superlinearly with page size (${scaleFactor.toFixed(1)}x).`);
}

const ok = breaches.length === 0 && failed.length === 0 && (scaleFactor ?? 0) <= SCALE_LIMIT;
process.exit(ok ? 0 : 1);
