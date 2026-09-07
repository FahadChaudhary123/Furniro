/**
 * Catalogue module — public interface.
 *
 * This file is the ONLY thing other modules may import from `catalogue`. Reaching into
 * `./data/products.js` or `./lib/*` directly breaks the boundary that makes this module
 * replaceable — see docs/MODULES.md#boundary-rules.
 *
 * When the API lands (docs/API.md, GET /api/products), the selectors below become the
 * fetch boundary and every consumer keeps working unchanged. That is the point of them.
 */

import { products, FEATURED_SLUGS, CATEGORIES } from './data/products.js';

export { CATEGORIES };
export { badgeFor } from './lib/badge.js';

/** Every product, catalogue order. */
export const getAllProducts = () => products;

/** The curated home-page selection, in the order it is merchandised. */
export const getFeaturedProducts = () =>
  FEATURED_SLUGS.map((slug) => products.find((p) => p.slug === slug)).filter(Boolean);

/** One product, or undefined. Slug rather than id so URLs survive a reseed. */
export const getProductBySlug = (slug) => products.find((p) => p.slug === slug);

/** Products in a category, or all of them when no category is given. */
export const getProductsByCategory = (category) =>
  category ? products.filter((p) => p.category === category) : products;

/**
 * Sort comparators for the shop controls. A closed map, not a lookup by arbitrary string —
 * the same whitelist discipline the API will need to keep `sort` out of an ORDER BY clause
 * (docs/API.md, GET /api/products).
 */
export const SORT_OPTIONS = {
  default: { label: 'Default', compare: null },
  'price-asc': { label: 'Price: Low to High', compare: (a, b) => a.price - b.price },
  'price-desc': { label: 'Price: High to Low', compare: (a, b) => b.price - a.price },
  'name-asc': { label: 'Name: A to Z', compare: (a, b) => a.name.localeCompare(b.name) },
  newest: {
    label: 'Newest',
    compare: (a, b) => new Date(b.created_at) - new Date(a.created_at),
  },
};

/** Non-mutating sort. `products` is module state; never sort it in place. */
export const sortProducts = (list, sortKey) => {
  const compare = SORT_OPTIONS[sortKey]?.compare;
  return compare ? [...list].sort(compare) : list;
};
