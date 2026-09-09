/**
 * Discontinued-product redirects — `CAT-08`. The ranking, and nothing else.
 *
 * Pure and dependency-free, for the same reason `publishGate.js` is: the front-end build
 * imports this to generate `dist/_redirects`, and it must not drag the API's runtime with
 * it. An earlier version had the build importing `service.js`, which reaches
 * `repository.js` → `logger.js` → `config.js` → `dotenv`, and the CI job that installs only
 * the front end's dependencies failed with `ERR_MODULE_NOT_FOUND: dotenv`.
 *
 * One definition of "where does a withdrawn product send you", used by both the API (which
 * answers 410 with it) and the build (which writes a 301 rule from it). A redirect map with
 * its own copy of this ranking would eventually disagree with the API.
 *
 * Operates on RAW catalogue rows — `category` as the string it is in the JSON, not the
 * embedded `{id, slug, name}` the API returns — because that is the shape both callers have
 * before any hydration happens.
 */

import { evaluateAll } from './publishGate.js';

/** `"Living Room"` -> `"living-room"`. The same rule the repository uses for category ids. */
export const categorySlug = (name) =>
  typeof name === 'string' ? name.toLowerCase().replaceAll(' ', '-') : null;

/**
 * Slugs that exist in the data but are not served.
 *
 * Two ways in: the product failed a blocking publish-gate rule, or it carries
 * `discontinued: true`. Both mean "this URL was real and is not any more", which is a
 * different thing from a URL that never existed and deserves a different answer.
 *
 * @returns {Map<string, {slug: string, category: string, reason: string}>}
 */
export function findUnpublished(products = [], categories = []) {
  const gate = evaluateAll(products, { categoryNames: new Set(categories) });

  const entries = [
    ...gate.blocked.map((b) => ({ row: b.product, reason: 'failed the publish gate' })),
    ...products.filter((p) => p?.discontinued === true).map((row) => ({ row, reason: 'discontinued' })),
  ]
    .filter(({ row }) => typeof row?.slug === 'string' && row.slug)
    // A discontinued product that ALSO fails the gate appears twice; the Map keeps one.
    .map(({ row, reason }) => [row.slug, { slug: row.slug, category: row.category, reason }]);

  return new Map(entries);
}

/**
 * Where to send someone who asked for a product that is no longer sold.
 *
 * Doc B §15 asks for "a 301 to the nearest live alternative". "Nearest" is doing the work in
 * that sentence, and this ranking is a judgement, not a fact:
 *
 *   1. The newest live product in the same category. Someone looking at a discontinued
 *      dining chair wants a dining chair, and without a successor field in the data,
 *      recency is the best proxy available for "the thing that replaced it".
 *   2. The category listing, when the category exists but has nothing live left in it. A
 *      listing is a worse landing page than a product and much better than a 404.
 *   3. `/shop`. Always exists, always renders.
 *
 * Never returns a target that might be missing: a redirect to a dead URL is a 404 with
 * extra steps.
 *
 * @returns {{to: string, kind: 'product'|'category'|'shop', reason: string}|null}
 *          null when the slug was never a product — that is a real 404.
 */
export function resolveRedirect(slug, products = [], categories = []) {
  const unpublished = findUnpublished(products, categories);
  const gone = unpublished.get(slug);
  if (!gone) return null;

  const live = products.filter(
    (p) => p?.discontinued !== true && !unpublished.has(p?.slug),
  );

  const inCategory = live
    .filter((p) => p.category === gone.category)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (inCategory.length > 0) {
    return { to: `/shop/${inCategory[0].slug}`, kind: 'product', reason: gone.reason };
  }

  if (gone.category && categories.includes(gone.category)) {
    return {
      to: `/shop?category=${categorySlug(gone.category)}`,
      kind: 'category',
      reason: gone.reason,
    };
  }

  return { to: '/shop', kind: 'shop', reason: gone.reason };
}

/**
 * The whole redirect map, for generating host configuration that serves real 301s.
 * A client-side redirect is a fallback, not an equivalent: it costs a round trip and search
 * engines treat it less reliably than an HTTP 301.
 */
export function listRedirects(products = [], categories = []) {
  return [...findUnpublished(products, categories).values()]
    .map(({ slug }) => ({ from: `/shop/${slug}`, ...resolveRedirect(slug, products, categories) }))
    .filter((r) => r.to);
}
