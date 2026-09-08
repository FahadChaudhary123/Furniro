#!/usr/bin/env node
/**
 * Compares each image's intrinsic width against the box it is actually displayed in.
 *
 * A blanket max-width caps the worst offenders but ignores how an image is used. Shipping a
 * 1600px file into a 384px slot wastes far more bytes than any format conversion recovers —
 * WebP saved 23% here, while correcting the dimensions saves several times that.
 *
 * Display widths below were measured in a browser at a 1440px viewport
 * (see e2e/performance.spec.js for the assertion that keeps them honest).
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { displayWidthFor } from './image-display-widths.mjs';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets');


function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

const files = walk(SRC).filter((f) => /\.(jpe?g|png)$/i.test(f));
const rows = [];

for (const file of files) {
  const rel = relative(SRC, file).replace(/\\/g, '/');
  const meta = await sharp(file).metadata();
  const bytes = statSync(file).size;
  const display = displayWidthFor(rel);
  rows.push({ rel, width: meta.width, bytes, display, ratio: display ? meta.width / display : null });
}

rows.sort((a, b) => b.bytes - a.bytes);

console.log('\n  Intrinsic width vs the box it renders into (2x is the retina allowance)\n');
console.log(`  ${'File'.padEnd(26)} ${'Width'.padStart(6)} ${'Size'.padStart(8)} ${'Display'.padStart(8)}  Ratio`);
console.log(`  ${'-'.repeat(26)} ${'-'.repeat(6)} ${'-'.repeat(8)} ${'-'.repeat(8)}  -----`);

let wasted = 0;
for (const r of rows) {
  const flag = r.ratio && r.ratio > 2.2 ? '  <-- oversized' : '';
  if (r.ratio && r.ratio > 2.2) wasted += r.bytes;
  console.log(
    `  ${r.rel.padEnd(26)} ${String(r.width).padStart(6)} ${(r.bytes / 1024).toFixed(0).padStart(6)}kB ` +
      `${String(r.display ?? '?').padStart(8)}  ${r.ratio ? r.ratio.toFixed(1) + 'x' : '?'}${flag}`,
  );
}

const total = rows.reduce((n, r) => n + r.bytes, 0);
console.log(`\n  Total ${(total / 1048576).toFixed(2)} MB, of which ${(wasted / 1024).toFixed(0)} kB is in oversized files.\n`);
