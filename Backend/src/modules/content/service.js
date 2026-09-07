/** Content business rules. No HTTP here. */

import * as repo from './repository.js';

export const DEFAULT_LIMIT = 3; // the blog page shows three
export const MAX_LIMIT = 50;

export function listPosts({ page = 1, limit = DEFAULT_LIMIT, tag = null } = {}) {
  let items = repo.findAll();
  if (tag) items = items.filter((p) => p.tag.toLowerCase() === tag.toLowerCase());

  const total = items.length;
  const start = (page - 1) * limit;

  return {
    data: items.slice(start, start + limit),
    meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** Compact form for the "Recent posts" sidebar — no body, which is the bulk of a post. */
export const getRecentPosts = (limit = 5) =>
  repo.findAll()
    .slice(0, limit)
    .map(({ id, slug, title, image, published_at }) => ({ id, slug, title, image, published_at }));

export const getPostBySlug = (slug) => repo.findBySlug(slug);

export const listTags = () => repo.findTags();

export const tagExists = (slug) =>
  repo.findTags().some((t) => t.slug === String(slug).toLowerCase());
