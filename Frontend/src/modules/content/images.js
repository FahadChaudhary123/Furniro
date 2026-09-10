/**
 * Resolves the image keys the content API returns into bundled assets.
 *
 * Same approach as the catalogue module: the API returns `"blog/blog1.jpg"`, and the client
 * decides where the bytes live. Each module resolves its own assets rather than sharing a
 * resolver, so a module can be lifted out without dragging another's images with it.
 */

import { buildAssetPairs } from '../../shared/lib/assetPairs.js';

const pairs = buildAssetPairs(
  import.meta.glob('../../assets/blog*.{jpg,webp,avif}', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);

/** @returns {{src: string, webp?: string}} sources for <Picture> */
export function resolveImage(key) {
  if (!key) return { src: '' };
  if (/^(https?:)?\//.test(key)) return { src: key };

  const name = key.split('/').pop().replace(/\.[^.]+$/, '');
  const pair = pairs[name];

  if (!pair && import.meta.env.DEV) {
    console.warn(`[content] no bundled asset for image key "${key}"`);
  }
  return pair ?? { src: '' };
}
