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
  gate.publishable.map((p) =>
    Object.freeze({ ...p, category: categoryByName.get(p.category) ?? null }),
  ),
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
