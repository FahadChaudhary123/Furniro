/**
 * Content data access — the only file in this module that touches a data store.
 *
 * Today a JSON file; docs/DATA_MODEL.md#proposed-schema has the `blog_posts` table it
 * stands in for. Swapping this file is the whole migration.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(HERE, 'data', 'posts.json'), 'utf8'));

// Frozen: shared module state. Newest first — `published_at` is a real date, so this sorts.
// The original data carried "14 Oct 2022" as a display string, which cannot be ordered.
const posts = Object.freeze(
  [...raw.posts]
    .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
    .map((p) => Object.freeze(p)),
);

export const findAll = () => posts;

export const findBySlug = (slug) => posts.find((p) => p.slug === slug) ?? null;

/**
 * Tags with their real post counts.
 *
 * The sidebar previously hard-coded these (Crafts 2, Design 8, Handmade 7, Interior 1,
 * Wood 6) against three actual posts — numbers that were simply invented. Deriving them
 * means they cannot be wrong.
 */
export const findTags = () => {
  const counts = new Map();
  for (const p of posts) counts.set(p.tag, (counts.get(p.tag) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, slug: name.toLowerCase().replaceAll(' ', '-'), count }))
    .sort((a, b) => a.name.localeCompare(b.name));
};
