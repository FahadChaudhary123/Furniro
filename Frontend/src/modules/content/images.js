/**
 * Resolves the image keys the content API returns into bundled assets.
 *
 * Same approach as the catalogue module: the API returns `"blog/blog1.jpg"`, and the client
 * decides where the bytes live. Each module resolves its own assets rather than sharing a
 * resolver, so a module can be lifted out without dragging another's images with it.
 */

const bundled = import.meta.glob('../../assets/blog*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
});

const byKey = Object.fromEntries(
  Object.entries(bundled).map(([path, url]) => [`blog/${path.split('/').pop()}`, url]),
);

export function resolveImage(key) {
  if (!key) return '';
  if (/^(https?:)?\//.test(key)) return key;
  const url = byKey[key];
  if (!url && import.meta.env.DEV) {
    console.warn(`[content] no bundled asset for image key "${key}"`);
  }
  return url ?? '';
}
