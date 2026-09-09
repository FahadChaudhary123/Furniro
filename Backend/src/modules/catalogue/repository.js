/**
 * Catalogue data access — the ONLY file in this module that touches a data store.
 *
 * Today that store is a JSON file loaded into memory. There is no database yet: no schema
 * has been created, and creating one against a live Supabase project is not something to
 * do implicitly. See docs/DATA_MODEL.md#proposed-schema for the tables this replaces.
 *
 * The point of this file is that swapping it is the whole migration. Every function below
 * returns plain rows and takes plain arguments; when Supabase is real, `getSupabase()`
 * replaces the array operations and nothing above this file changes.
 * See docs/MODULES.md#boundary-rules.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { logger } from '../../platform/logger.js';
import { evaluateAll } from './publishGate.js';
import { findUnpublished as computeUnpublished } from './redirects.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const raw = JSON.parse(readFileSync(join(HERE, 'data', 'products.json'), 'utf8'));

/** Categories get stable ids from their position, so the API can embed `{id, slug, name}`. */
const categories = raw.categories.map((name, index) => ({
  id: index + 1,
  slug: name.toLowerCase().replaceAll(' ', '-'),
  name,
}));

const categoryByName = new Map(categories.map((c) => [c.name, c]));

/**
 * CAT-03 — the publish gate runs here, once, at load.
 *
 * A product that fails a blocking rule is not served: not on a listing, not by slug, not as
 * a featured item. Doing it at the data boundary rather than in each read means there is no
 * path that can accidentally bypass it, which is what "not by eye" has to mean in code.
 *
 * The count is logged at boot so a catalogue that quietly shrank after a data edit is
 * visible in the log rather than discovered by a customer. `npm run completeness` prints
 * the detail.
 */
const gate = evaluateAll(raw.products, { categoryNames: new Set(raw.categories) });

/**
 * CAT-08 — slugs that exist in the data but are not served.
 *
 * Computed by `redirects.js`, which is pure and dependency-free so the front-end build can
 * import the same ranking without dragging this file's imports (and therefore dotenv) with
 * it. Keeping the row rather than dropping it is the point: a slug the server has forgotten
 * can only 404, and Doc B §15 is explicit that an indexed URL should never land on one.
 */
const unpublished = computeUnpublished(raw.products, raw.categories);

if (gate.blocked.length > 0) {
  logger.warn('publish gate blocked products', {
    blocked: gate.blocked.length,
    of: raw.products.length,
    slugs: gate.blocked.map((b) => b.report.slug),
  });
}

// Frozen: this is module state shared by every request. A caller that sorts it in place
// would reorder the catalogue for everyone.
const products = Object.freeze(
  gate.publishable
    // `discontinued` removes a product from sale without deleting the row, so the redirect
    // above still has a category to work from.
    .filter((p) => p.discontinued !== true)
    .map((p) => Object.freeze({ ...p, category: categoryByName.get(p.category) ?? null })),
);

const featuredSlugs = raw.featured;

export const findAll = () => products;

export const findBySlug = (slug) => products.find((p) => p.slug === slug) ?? null;

export const findFeatured = () =>
  featuredSlugs.map((slug) => products.find((p) => p.slug === slug)).filter(Boolean);

export const findCategories = () =>
  categories.map((c) => ({
    ...c,
    product_count: products.filter((p) => p.category?.id === c.id).length,
  }));

export const findCategoryBySlug = (slug) => categories.find((c) => c.slug === slug) ?? null;

/**
 * A slug that is known but not served — `CAT-08`.
 * @returns {{slug: string, category: string, reason: string}|null}
 */
export const findUnpublished = (slug) => unpublished.get(slug) ?? null;

/** Every unpublished slug, for the redirect map the host serves as real 301s. */
export const findAllUnpublished = () => [...unpublished.values()];

/**
 * Raw catalogue rows, exactly as the data file holds them — `category` as a string, no
 * embedded object. The redirect ranking works on this shape because the front-end build has
 * the same file and no hydration step.
 */
export const findRawProducts = () => raw.products;
export const findRawCategories = () => raw.categories;
