/**
 * Turns a Vite glob of images into `{ name: { src, webp } }` pairs.
 *
 * `optimise-images.mjs` writes a `.webp` beside every `.jpg`/`.png`, so a glob covering
 * both formats yields both halves of each pair. The JPEG stays the `<img>` source and the
 * WebP becomes a `<source>` — see `<Picture>`.
 *
 * A glob rather than two explicit imports per image: some sections carry nine images, and
 * eighteen imports to serve nine pictures is not a readable file.
 *
 * @param {Record<string, string>} glob - eager glob result, path -> url
 * @returns {Record<string, {src: string, webp?: string}>} keyed by filename without extension
 */
export function buildAssetPairs(glob) {
  const pairs = {};

  for (const [path, url] of Object.entries(glob)) {
    const file = path.split('/').pop();
    const dot = file.lastIndexOf('.');
    const name = file.slice(0, dot);
    const ext = file.slice(dot + 1).toLowerCase();

    pairs[name] ??= { src: '' };
    if (ext === 'webp') pairs[name].webp = url;
    else pairs[name].src = url;
  }

  return pairs;
}
