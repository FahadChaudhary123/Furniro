/**
 * Catalogue business rules. Knows nothing about HTTP — no req, no res, no status codes.
 * That is what makes it testable without a server.
 */

import * as repo from './repository.js';

export const DEFAULT_LIMIT = 16; // matches the shop grid's page size
export const MAX_LIMIT = 100; // an uncapped limit is a one-request denial of service
export const MAX_SLUGS = 50; // same reasoning: a slug list is an unbounded input

/**
 * Sort whitelist. A closed map, never a lookup by arbitrary string — when this is backed by
 * SQL, a `sort` parameter interpolated into an ORDER BY is a classic injection vector.
 * docs/API.md#get-apiproducts.
 */
export const SORT = {
  'created_at:desc': (a, b) => new Date(b.created_at) - new Date(a.created_at),
  'created_at:asc': (a, b) => new Date(a.created_at) - new Date(b.created_at),
  'price:asc': (a, b) => a.price - b.price,
  'price:desc': (a, b) => b.price - a.price,
  'name:asc': (a, b) => a.name.localeCompare(b.name),
  'name:desc': (a, b) => b.name.localeCompare(a.name),
};

export const DEFAULT_SORT = 'created_at:desc';

/**
 * Paginated, filtered catalogue.
 * @param {object} q - already validated by the controller
 */
export function listProducts(q = {}) {
  const {
    page = 1,
    limit = DEFAULT_LIMIT,
    category = null,
    sort = DEFAULT_SORT,
    search = null,
    minPrice = null,
    maxPrice = null,
    slugs = null,
  } = q;

  let items = repo.findAll();

  // Batch lookup by slug. The cart needs several products at once and must never trust a
  // client-held price, so it re-reads them from here rather than caching its own copy.
  // One request beats N.
  if (slugs?.length) {
    const wanted = new Set(slugs);
    items = items.filter((p) => wanted.has(p.slug));
  }

  if (category) items = items.filter((p) => p.category?.slug === category);

  if (search) {
    const needle = search.toLowerCase();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.description.toLowerCase().includes(needle),
    );
  }

  if (minPrice !== null) items = items.filter((p) => p.price >= minPrice);
  if (maxPrice !== null) items = items.filter((p) => p.price <= maxPrice);

  // Copy before sorting: repository rows are shared module state.
  const compare = SORT[sort];
  const sorted = compare ? [...items].sort(compare) : items;

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;

  return {
    data: sorted.slice(start, start + limit),
    meta: { page, limit, total, total_pages: totalPages },
  };
}

export const getFeatured = () => repo.findFeatured();

export const getBySlug = (slug) => repo.findBySlug(slug);

export const listCategories = () => repo.findCategories();

export const categoryExists = (slug) => repo.findCategoryBySlug(slug) !== null;

/**
 * Where to send someone who asked for a product that is no longer sold — `CAT-08`.
 *
 * Doc B §15 asks for "a 301 to the nearest live alternative". "Nearest" is doing the work
 * in that sentence, and the ranking below is a judgement, not a fact:
 *
 *   1. The newest live product in the same category. Someone looking at a discontinued
 *      dining chair wants a dining chair, and recency is the best proxy available for
 *      "the thing that replaced it" without a real successor field in the data.
 *   2. The category listing, if the category exists but has nothing live in it. A listing
 *      is a worse landing page than a product, and much better than a 404.
 *   3. `/shop`. Always exists, always renders.
 *
 * Never returns null: a redirect target that might be missing is a 404 with extra steps.
 *
 * @param {string} slug the discontinued or blocked slug
 * @returns {{to: string, kind: 'product'|'category'|'shop', reason: string}|null}
 *          null when the slug was never a product at all — that is a real 404.
 */
export function resolveRedirect(slug) {
  const gone = repo.findUnpublished(slug);
  if (!gone) return null;

  const inCategory = repo
    .findAll()
    .filter((p) => p.category?.name === gone.category)
    .sort(SORT['created_at:desc']);

  if (inCategory.length > 0) {
    return { to: `/shop/${inCategory[0].slug}`, kind: 'product', reason: gone.reason };
  }

  const category = gone.category
    ? repo.findCategoryBySlug(gone.category.toLowerCase().replaceAll(' ', '-'))
    : null;

  if (category) {
    return { to: `/shop?category=${category.slug}`, kind: 'category', reason: gone.reason };
  }

  return { to: '/shop', kind: 'shop', reason: gone.reason };
}

/**
 * The whole redirect map, for generating host configuration that serves real 301s.
 * A client-side redirect is a fallback, not an equivalent: it costs a round trip and
 * search engines treat it less reliably than an HTTP 301.
 */
export const listRedirects = () =>
  repo
    .findAllUnpublished()
    .map(({ slug }) => ({ from: `/shop/${slug}`, ...resolveRedirect(slug) }))
    .filter((r) => r.to);
