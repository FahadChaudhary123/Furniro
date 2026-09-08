#!/usr/bin/env node
/**
 * Performance budget gate — Document B §12.
 *
 *   "Budgets are enforced in CI. Bundle size, image weight and third-party script count
 *    are gates, not guidelines."
 *
 * Run after `npm run build`. Exits non-zero if any budget is exceeded, which fails CI.
 *
 * Budgets are deliberately set just above current measured values, so they ratchet: they
 * catch a regression without demanding an improvement nobody scheduled. Tighten them when
 * you improve something — a budget that drifts upward silently is not a gate.
 */

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

const KB = 1024;
const MB = 1024 * 1024;

const BUDGETS = {
  jsGzip: 115 * KB,       // all .js, gzipped, summed (measured 102.2 kB)
  cssGzip: 25 * KB,       // all .css, gzipped, summed
  totalAssets: 1.9 * MB,  // worst-case single visitor (measured 1.60 MB)
  largestAsset: 300 * KB, // no single file may exceed this (measured 265.5 kB)
  thirdPartyScripts: 0,   // Doc B §12: most storefront regressions arrive as a marketing tag
};

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

function fmt(bytes) {
  if (bytes >= MB) return `${(bytes / MB).toFixed(2)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(1)} kB`;
  return `${bytes} B`;
}

if (!existsSync(DIST)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

const files = walk(DIST);
if (files.length === 0) {
  console.error('dist/ is empty. The build produced nothing.');
  process.exit(1);
}

let jsGzip = 0;
let cssGzip = 0;
let largest = { path: '', size: 0 };

/**
 * Bytes ONE VISITOR downloads — not bytes on disk.
 *
 * With <picture>, every image ships as both a JPEG and a WebP, but a browser fetches
 * exactly one of them. Summing the directory counts both and makes adding a modern format
 * look like a regression, which would turn this gate against the improvement it should be
 * rewarding.
 *
 * Each image is therefore counted once, at its LARGER variant: the worst case is an old
 * browser taking the JPEG.
 */
const sizes = new Map();
for (const f of files) {
  const rel = relative(DIST, f);
  /*
   * Group a.jpg / a.webp under one key, stripping Vite's per-file hash.
   *
   * The hash is EXACTLY 8 characters. An earlier `{8,}` here was greedy and ate the
   * filename too — `bedroom-1-T6WbvKiL` collapsed to `bedroom`, merging four distinct
   * images into one group and under-reporting the total by ~25%.
   */
  const key = rel.replace(/\.(jpe?g|png|webp)$/i, '').replace(/-[A-Za-z0-9_-]{8}$/, '');
  const isImage = /\.(jpe?g|png|webp)$/i.test(rel);
  const size = statSync(f).size;

  if (isImage) sizes.set(key, Math.max(sizes.get(key) ?? 0, size));
  else sizes.set(rel, size);

  if (size > largest.size) largest = { path: rel, size };

  const ext = extname(f);
  if (ext === '.js' || ext === '.mjs') jsGzip += gzipSync(readFileSync(f)).length;
  if (ext === '.css') cssGzip += gzipSync(readFileSync(f)).length;
}

const totalAssets = [...sizes.values()].reduce((a, b) => a + b, 0);

// Count <script src="http..."> in every emitted HTML file. Anything loaded from another
// origin is a third party, whoever added it.
let thirdPartyScripts = 0;
for (const f of files.filter((f) => extname(f) === '.html')) {
  const html = readFileSync(f, 'utf8');
  thirdPartyScripts += (html.match(/<script[^>]+src=["']https?:\/\//gi) ?? []).length;
}

const results = [
  ['JS (gzipped)', jsGzip, BUDGETS.jsGzip],
  ['CSS (gzipped)', cssGzip, BUDGETS.cssGzip],
  ['Total assets (one visitor)', totalAssets, BUDGETS.totalAssets],
  [`Largest asset (${largest.path})`, largest.size, BUDGETS.largestAsset],
  ['Third-party scripts', thirdPartyScripts, BUDGETS.thirdPartyScripts],
];

const isCount = (label) => label === 'Third-party scripts';
const show = (label, v) => (isCount(label) ? String(v) : fmt(v));

let failed = 0;
console.log('\nPerformance budgets (Document B §12)\n');
console.log(`  ${'Metric'.padEnd(42)} ${'Actual'.padStart(10)} ${'Budget'.padStart(10)}   Status`);
console.log(`  ${'-'.repeat(42)} ${'-'.repeat(10)} ${'-'.repeat(10)}   ------`);

for (const [label, actual, budget] of results) {
  const over = actual > budget;
  if (over) failed++;
  const pct = budget > 0 ? ` (${Math.round((actual / budget) * 100)}%)` : '';
  console.log(
    `  ${label.padEnd(42)} ${show(label, actual).padStart(10)} ${show(label, budget).padStart(10)}   ${
      over ? `OVER${pct}` : 'ok'
    }`,
  );
}

console.log('');

if (failed > 0) {
  console.error(
    `${failed} budget${failed > 1 ? 's' : ''} exceeded. See docs/OPS_CONFORMANCE.md#12-performance-budgets--currently-unmet\n` +
      'If the increase is intentional and justified, raise the budget in this file in the ' +
      'same commit — with a reason in the message, not silently.\n',
  );
  process.exit(1);
}

console.log('All budgets within limits.\n');
