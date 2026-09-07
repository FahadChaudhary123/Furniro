#!/usr/bin/env node
/**
 * Guards the front end's catalogue against the back end's.
 *
 * They are duplicated on purpose, temporarily: the front end still renders from local data
 * because it does not fetch yet. Two copies of product data is precisely the defect this
 * project already had once — two incompatible shapes across two components, with wrong
 * prices and 404 images. This check makes a recurrence a failing build rather than a
 * customer-visible bug.
 *
 * The duplication ends when the front end fetches from GET /api/products. Delete this
 * script then.
 *
 *   npm run check:catalogue
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const GENERATED = join(HERE, '..', 'src', 'modules', 'catalogue', 'data', 'products.json');

const current = readFileSync(GENERATED, 'utf8');

// Regenerate from the front-end source into a temp comparison, without overwriting.
const before = current;
execFileSync(process.execPath, [join(HERE, 'generate-catalogue.mjs')], { stdio: 'pipe' });
const after = readFileSync(GENERATED, 'utf8');

if (before === after) {
  const { products } = JSON.parse(after);
  console.log(`\n  ok  back-end catalogue matches the front end (${products.length} products)\n`);
  process.exit(0);
}

// Report what moved rather than just "they differ".
const parse = (s) => JSON.parse(s).products;
const a = parse(before);
const b = parse(after);
const key = (p) => p.slug;
const byA = new Map(a.map((p) => [key(p), p]));
const byB = new Map(b.map((p) => [key(p), p]));

const added = [...byB.keys()].filter((k) => !byA.has(k));
const removed = [...byA.keys()].filter((k) => !byB.has(k));
const changed = [...byB.keys()]
  .filter((k) => byA.has(k))
  .map((k) => {
    const fields = Object.keys(byB.get(k)).filter(
      (f) => JSON.stringify(byA.get(k)[f]) !== JSON.stringify(byB.get(k)[f]),
    );
    return fields.length ? { slug: k, fields } : null;
  })
  .filter(Boolean);

console.error('\n  DRIFT: the back-end catalogue is out of date with the front end.\n');
if (added.length) console.error(`    added:   ${added.join(', ')}`);
if (removed.length) console.error(`    removed: ${removed.join(', ')}`);
for (const c of changed) console.error(`    changed: ${c.slug} (${c.fields.join(', ')})`);
console.error('\n  The file has been regenerated. Review the diff and commit it.\n');
process.exit(1);
