/**
 * Resolves the image *keys* the API returns into bundled asset URLs.
 *
 * The API is storage-agnostic: it returns `"products/product1.jpg"`, not a URL. That is
 * deliberate — docs/DATA_MODEL.md#resolution — because baking a path into the data is what
 * produced 32 broken images the first time round. The client decides where the bytes live.
 *
 * `import.meta.glob` with `eager` resolves at build time, so every referenced image is
 * hashed and emitted by Vite exactly as a static import would be. Nothing is fetched at
 * runtime to build this map.
 *
 * When product media moves to object storage (Doc B §8 lists it as a backed-up store), the
 * API returns absolute URLs and this file shrinks to a passthrough.
 */

import { buildAssetPairs } from '../../shared/lib/assetPairs.js';

// Both formats: the JPEG is the fallback, the WebP is what most browsers will take.
const pairs = buildAssetPairs(
  import.meta.glob('../../assets/Products/*.{jpg,webp}', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);

/**
 * @param {string} key - e.g. "products/product1.jpg"
 * @returns {{src: string, webp?: string}} sources for <Picture>
 */
export function resolveImage(key) {
  if (!key) return { src: '' };
  if (/^(https?:)?\//.test(key)) return { src: key };

  const name = key.split('/').pop().replace(/\.[^.]+$/, '');
  const pair = pairs[name];

  if (!pair && import.meta.env.DEV) {
    // Loud in development, silent in production: a missing image should not blank a page.
    console.warn(`[catalogue] no bundled asset for image key "${key}"`);
  }
  return pair ?? { src: '' };
}
