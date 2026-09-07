/**
 * Catalogue module — public interface.
 *
 * The only file other parts of the app may import from `catalogue`. Reaching into
 * ./api.js or ./hooks.js directly breaks the boundary — docs/MODULES.md#boundary-rules.
 *
 * Products now come from GET /api/products. The local `data/products.js` that stood in for
 * the API is gone; the back end's `products.json` is the single source, which is what
 * retired the drift guard between them.
 */

export { useProducts, useProduct, useFeaturedProducts, useCategories } from './hooks.js';
export { fetchProduct, ApiError } from './api.js';
export { badgeFor } from './lib/badge.js';

/**
 * Sort options for the shop control. Keys are the API's `sort` values verbatim, so the
 * control cannot drift from what the server accepts — the server validates against a
 * closed whitelist and rejects anything else with a 400.
 */
export const SORT_OPTIONS = {
  'created_at:desc': 'Newest',
  'price:asc': 'Price: Low to High',
  'price:desc': 'Price: High to Low',
  'name:asc': 'Name: A to Z',
};

export const DEFAULT_SORT = 'created_at:desc';
