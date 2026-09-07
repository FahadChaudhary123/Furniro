#!/usr/bin/env node
/**
 * Image optimisation — Document B §15 ("no oversized originals on the page") and §12
 * (image weight is a CI gate).
 *
 * The source images are camera-resolution originals shipped verbatim to the browser. This
 * resizes and re-encodes them in place, so no import path changes and no component is
 * touched.
 *
 * Safety:
 *   - Originals are copied to .image-originals/ (gitignored) before anything is written.
 *   - Every run re-encodes FROM that backup, never from the already-optimised file, so
 *     running it repeatedly does not compound JPEG generation loss.
 *   - To restore: copy .image-originals/ back over src/assets/.
 *
 * Usage:
 *   node scripts/optimise-images.mjs            # optimise
 *   node scripts/optimise-images.mjs --dry-run  # report only, write nothing
 */

import { readdirSync, statSync, existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { join, extname, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src', 'assets');
const BACKUP = join(ROOT, '.image-originals');

const DRY = process.argv.includes('--dry-run');

// 1600 keeps a full-bleed hero crisp on a 1080p display without paying for camera
// resolution -- nothing on this site is displayed larger. 1920 was tried first and left a
// single 486 kB room photo over the 450 kB per-asset budget; 1600 meets the budget rather
// than moving it, at no visible cost on the sizes actually rendered.
const MAX_EDGE = 1600;
// 82 rather than a more aggressive 75: these are product photographs on a storefront, and
// the difference in bytes is small next to the cost of a customer seeing artefacts.
const JPEG = { quality: 82, mozjpeg: true, progressive: true };
// Lossless. `palette: true` quantises to 256 colours, which bands a photographic PNG
// visibly — hero-bg.png is a photograph. Savings are smaller; the image stays intact.
const PNG = { compressionLevel: 9, effort: 10 };

const EXTS = new Set(['.jpg', '.jpeg', '.png']);

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const KB = 1024;
const MB = 1024 * 1024;
const fmt = (b) =>
  b >= MB ? `${(b / MB).toFixed(2)} MB` : b >= KB ? `${(b / KB).toFixed(0)} kB` : `${b} B`;

const images = walk(SRC).filter((f) => EXTS.has(extname(f).toLowerCase()));

if (images.length === 0) {
  console.error(`No images found under ${SRC}`);
  process.exit(1);
}

console.log(`\n${DRY ? 'DRY RUN — ' : ''}Optimising ${images.length} images (max edge ${MAX_EDGE}px)\n`);

let before = 0;
let after = 0;
const rows = [];

for (const file of images) {
  const rel = relative(SRC, file);
  const backup = join(BACKUP, rel);

  // First run for this file: preserve the original before touching anything.
  if (!existsSync(backup)) {
    if (!DRY) {
      mkdirSync(dirname(backup), { recursive: true });
      copyFileSync(file, backup);
    }
  }

  // Always encode from the pristine original, never from a previous output.
  const source = existsSync(backup) ? backup : file;
  const origSize = statSync(source).size;

  const img = sharp(source);
  const meta = await img.metadata();

  const needsResize = meta.width > MAX_EDGE || meta.height > MAX_EDGE;
  let pipeline = sharp(source).rotate(); // rotate() applies EXIF orientation, then strips it

  if (needsResize) {
    pipeline = pipeline.resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const ext = extname(file).toLowerCase();
  pipeline = ext === '.png' ? pipeline.png(PNG) : pipeline.jpeg(JPEG);

  const buf = await pipeline.toBuffer();

  before += origSize;
  // Never make a file bigger: if optimisation loses, keep the original bytes.
  const useOptimised = buf.length < origSize;
  after += useOptimised ? buf.length : origSize;

  rows.push({
    rel,
    dims: `${meta.width}x${meta.height}${needsResize ? ` -> ${MAX_EDGE}max` : ''}`,
    from: origSize,
    to: useOptimised ? buf.length : origSize,
    skipped: !useOptimised,
  });

  if (!DRY) {
    if (useOptimised) {
      // Write the encoded bytes directly. Passing `buf` back through sharp().toFile()
      // re-encodes it a second time: the file on disk would not match the size reported
      // above, and every JPEG would take an extra generation of loss for nothing.
      writeFileSync(file, buf);
    } else if (source !== file) {
      copyFileSync(source, file);
    }
  }
}

rows.sort((a, b) => b.from - a.from);

const w = Math.min(46, Math.max(...rows.map((r) => r.rel.length)) + 1);
console.log(`  ${'File'.padEnd(w)} ${'Dimensions'.padEnd(20)} ${'Before'.padStart(9)} ${'After'.padStart(9)}   Saved`);
console.log(`  ${'-'.repeat(w)} ${'-'.repeat(20)} ${'-'.repeat(9)} ${'-'.repeat(9)}   -----`);

for (const r of rows) {
  const saved = r.skipped ? 'skipped' : `${Math.round((1 - r.to / r.from) * 100)}%`;
  console.log(
    `  ${r.rel.padEnd(w)} ${r.dims.padEnd(20)} ${fmt(r.from).padStart(9)} ${fmt(r.to).padStart(9)}   ${saved}`,
  );
}

const pct = Math.round((1 - after / before) * 100);
console.log(`\n  Total: ${fmt(before)} -> ${fmt(after)}  (${pct}% smaller)`);
console.log(DRY ? '\n  Dry run — nothing written.\n' : `\n  Originals preserved in ${relative(ROOT, BACKUP)}/\n`);
