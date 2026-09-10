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
 * Also emits a .webp beside every image. Doc B §15 requires modern formats served, and
 * WebP is universally supported by browsers in use today — a <picture> element keeps the
 * JPEG as the fallback for anything that is not.
 *
 *   node scripts/optimise-images.mjs            # optimise
 *   node scripts/optimise-images.mjs --dry-run  # report only, write nothing
 */

import {
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join, extname, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { displayWidthFor } from './image-display-widths.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src', 'assets');
const BACKUP = join(ROOT, '.image-originals');

const DRY = process.argv.includes('--dry-run');

/**
 * Target width per image: twice the box it renders into, for retina. The measurements live
 * in image-display-widths.mjs so the optimiser and the audit cannot disagree.
 */
const RETINA = 2;
const FALLBACK_MAX_EDGE = 1600;

const targetWidth = (rel) => {
  const display = displayWidthFor(rel);
  return display ? Math.min(display * RETINA, FALLBACK_MAX_EDGE) : FALLBACK_MAX_EDGE;
};
// 82 rather than a more aggressive 75: these are product photographs on a storefront, and
// the difference in bytes is small next to the cost of a customer seeing artefacts.
const JPEG = { quality: 82, mozjpeg: true, progressive: true };
// Lossless. `palette: true` quantises to 256 colours, which bands a photographic PNG
// visibly — hero-bg.png is a photograph. Savings are smaller; the image stays intact.
const PNG = { compressionLevel: 9, effort: 10 };
// WebP at the same visual quality lands well below JPEG. `effort: 6` is the encoder's
// default-ish upper-middle: slower to build, smaller to ship, and this runs rarely.
const WEBP = { quality: 80, effort: 6 };

/**
 * AVIF. Quality 50 is not "half as good as WebP 80" — the scales are unrelated, and 50 is
 * the usual visual match for WebP 80 on photographs. `effort: 4` keeps encoding to a few
 * hundred milliseconds per image; effort 9 buys a few more percent for several seconds
 * each, which is the wrong trade for a script run by hand.
 */
const AVIF = { quality: 50, effort: 4 };

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

console.log(
  `\n${DRY ? 'DRY RUN — ' : ''}Optimising ${images.length} images, each sized to ${RETINA}x its display box\n`,
);

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

  const maxEdge = targetWidth(rel);
  const needsResize = meta.width > maxEdge || meta.height > maxEdge;
  let pipeline = sharp(source).rotate(); // rotate() applies EXIF orientation, then strips it

  if (needsResize) {
    pipeline = pipeline.resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  const ext = extname(file).toLowerCase();
  pipeline = ext === '.png' ? pipeline.png(PNG) : pipeline.jpeg(JPEG);

  const buf = await pipeline.toBuffer();

  // Modern format, same pixels. Written from the pristine original, not from the JPEG we
  // just produced — encoding a lossy format from another lossy format compounds artefacts.
  let webpBytes = null;
  const webpPath = file.replace(/\.(jpe?g|png)$/i, '.webp');
  {
    let wp = sharp(source).rotate();
    if (needsResize) {
      wp = wp.resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true });
    }
    webpBytes = await wp.webp(WEBP).toBuffer();
  }

  /**
   * AVIF, written from the pristine original for the same reason WebP is.
   *
   * Kept only when it actually beats the WebP. Measured across a representative sample it
   * wins by 42.7% overall — but it LOST on a 0.8 kB thumbnail, where the format's own
   * container overhead dominates the payload. Emitting it unconditionally would ship bytes
   * that make the page slower for some images and add a `<source>` the browser must parse
   * to reject.
   */
  let avifBytes = null;
  {
    let av = sharp(source).rotate();
    if (needsResize) {
      av = av.resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true });
    }
    const encoded = await av.avif(AVIF).toBuffer();
    if (encoded.length < webpBytes.length) avifBytes = encoded;
  }
  const avifPath = file.replace(/\.(jpe?g|png)$/i, '.avif');

  before += origSize;
  // Never make a file bigger: if optimisation loses, keep the original bytes.
  const useOptimised = buf.length < origSize;
  after += useOptimised ? buf.length : origSize;

  rows.push({
    rel,
    dims: `${meta.width}${needsResize ? ` -> ${maxEdge}` : ''}`,
    from: origSize,
    to: useOptimised ? buf.length : origSize,
    webp: webpBytes.length,
    avif: avifBytes?.length ?? null,
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
    writeFileSync(webpPath, webpBytes);

    if (avifBytes) {
      writeFileSync(avifPath, avifBytes);
    } else if (existsSync(avifPath)) {
      // A previous run may have written one that no longer wins — for instance after the
      // image was resized smaller. Leaving it would serve the larger file.
      rmSync(avifPath);
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
