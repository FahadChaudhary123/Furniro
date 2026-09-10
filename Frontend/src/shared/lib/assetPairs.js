/**
 * Turns a Vite glob of images into `{ name: { src, webp, avif } }` sets.
 *
 * `optimise-images.mjs` writes a `.webp` beside every `.jpg`/`.png`, and an `.avif` too
 * **where AVIF is actually smaller than the WebP** — it is not, for very small images, where
 * the format's own overhead dominates. So `avif` is optional in a way `webp` is not, and a
 * missing one is a measurement result rather than a gap.
 *
 * A glob rather than two explicit imports per image: some sections carry nine images, and
 * eighteen imports to serve nine pictures is not a readable file.
 *
 * @param {Record<string, string>} glob - eager glob result, path -> url
 * @returns {Record<string, {src: string, webp?: string, avif?: string}>} keyed by filename
 *          without extension
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
    else if (ext === 'avif') pairs[name].avif = url;
    else pairs[name].src = url;
  }

  return pairs;
}
