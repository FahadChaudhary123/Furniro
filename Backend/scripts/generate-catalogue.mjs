#!/usr/bin/env node
/**
 * Generates Backend/src/modules/catalogue/data/products.json from the front end's
 * canonical catalogue module.
 *
 * The two cannot share a file: they are separate npm roots, and the front end's data
 * carries Vite image imports that Node cannot resolve. Rather than retype 40 products —
 * which is how the two incompatible shapes arose in the first place — this derives one
 * from the other, mechanically.
 *
 * The front end's copy is a stand-in that retires when it fetches from this API. Until
 * then `npm run check:catalogue` guards the two against drift.
 *
 *   node scripts/generate-catalogue.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, '..', '..', 'Frontend', 'src', 'modules', 'catalogue', 'data', 'products.js');
const OUT_DIR = join(HERE, '..', 'src', 'modules', 'catalogue', 'data');
const OUT = join(OUT_DIR, 'products.json');

const src = readFileSync(SOURCE, 'utf8');

/** `rp(2_500_000)` -> 250000000 minor units. Mirrors toMinorUnits(). */
const money = (expr) => {
  const m = /rp\(\s*([\d_]+)\s*\)/.exec(expr);
  return m ? Number(m[1].replaceAll('_', '')) * 100 : null;
};

/**
 * `product3` or `img(7)` -> "products/product3.jpg".
 * img(n) indexes an 8-element array as (n - 1) % 8, so img(7) is product7.
 */
const imageKey = (expr) => {
  const direct = /^product(\d)$/.exec(expr.trim());
  if (direct) return `products/product${direct[1]}.jpg`;
  const cycled = /^img\(\s*(\d+)\s*\)$/.exec(expr.trim());
  if (cycled) return `products/product${((Number(cycled[1]) - 1) % 8) + 1}.jpg`;
  throw new Error(`Unrecognised image expression: ${expr}`);
};

const field = (block, name) => {
  const m = new RegExp(`\\b${name}:\\s*('([^']*)'|[^,}\\n]+)`).exec(block);
  return m ? (m[2] !== undefined ? m[2] : m[1].trim()) : null;
};

// Each product is one `{ ... }` block inside the exported array.
const arrayBody = /export const products = \[([\s\S]*?)\n\];/.exec(src);
if (!arrayBody) throw new Error('Could not locate `export const products` in the source.');

const blocks = arrayBody[1].match(/\{[\s\S]*?\}(?=,\s*(?:\/\/|\{|$))/g) ?? [];

const products = blocks.map((block) => {
  const oldPrice = field(block, 'old_price');
  return {
    id: Number(field(block, 'id')),
    slug: field(block, 'slug'),
    name: field(block, 'name'),
    description: field(block, 'description'),
    category: field(block, 'category'),
    price: money(field(block, 'price')),
    old_price: oldPrice && oldPrice !== 'null' ? money(oldPrice) : null,
    image: imageKey(field(block, 'image')),
    created_at: field(block, 'created_at'),
  };
});

const featured = [...(/FEATURED_SLUGS = \[([\s\S]*?)\]/.exec(src)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
  (m) => m[1],
);
const categories = [...(/CATEGORIES = \[([\s\S]*?)\]/.exec(src)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
  (m) => m[1],
);

// --- integrity, before writing anything ------------------------------------------------
const problems = [];
if (products.length === 0) problems.push('no products extracted');
for (const p of products) {
  for (const [k, v] of Object.entries(p)) {
    if (v === null && k !== 'old_price') problems.push(`${p.slug ?? p.id}: ${k} is null`);
  }
  if (p.old_price !== null && p.old_price <= p.price) {
    problems.push(`${p.slug}: old_price must exceed price`);
  }
  if (!categories.includes(p.category)) problems.push(`${p.slug}: unknown category ${p.category}`);
}
const slugs = products.map((p) => p.slug);
const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i);
if (dupes.length) problems.push(`duplicate slugs: ${dupes.join(', ')}`);
for (const s of featured) if (!slugs.includes(s)) problems.push(`featured slug not found: ${s}`);

if (problems.length) {
  console.error('\nExtraction failed:\n' + problems.map((p) => `  - ${p}`).join('\n') + '\n');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      _generated: 'by scripts/generate-catalogue.mjs from the front end catalogue — do not edit by hand',
      categories,
      featured,
      products,
    },
    null,
    2,
  ) + '\n',
);

console.log(`\nWrote ${products.length} products, ${categories.length} categories, ${featured.length} featured`);
console.log(`  -> ${OUT}\n`);
