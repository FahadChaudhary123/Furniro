/** HTTP concerns only. Validation at the edge, so the service can trust its arguments. */

import * as service from './service.js';
import { validationFailed, notFound } from '../../platform/index.js';

function intParam(raw, { field, min = 1, max = Number.MAX_SAFE_INTEGER, fallback }, problems) {
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(String(raw))) {
    problems.push({ field, issue: 'must be a positive integer' });
    return fallback;
  }
  const n = Number(raw);
  if (n < min || n > max) {
    const bounded = max !== Number.MAX_SAFE_INTEGER;
    problems.push({
      field,
      issue: bounded ? `must be between ${min} and ${max}` : `must be at least ${min}`,
    });
    return fallback;
  }
  return n;
}

export function listPosts(req, res) {
  const problems = [];
  const page = intParam(req.query.page, { field: 'page', fallback: 1 }, problems);
  const limit = intParam(
    req.query.limit,
    { field: 'limit', max: service.MAX_LIMIT, fallback: service.DEFAULT_LIMIT },
    problems,
  );

  const tag = req.query.tag ?? null;
  if (tag && !service.tagExists(tag)) problems.push({ field: 'tag', issue: 'unknown tag' });

  if (problems.length) throw validationFailed(problems);

  res.json(service.listPosts({ page, limit, tag }));
}

export function listRecent(req, res) {
  res.json({ data: service.getRecentPosts() });
}

export function listTags(req, res) {
  res.json({ data: service.listTags() });
}

export function getPost(req, res) {
  const post = service.getPostBySlug(req.params.slug);
  if (!post) throw notFound(`No post with slug "${req.params.slug}"`);
  res.json(post);
}
