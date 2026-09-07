/**
 * HTTP concerns only: parse the request, call the service, shape the response.
 *
 * Validation happens here, at the edge, so the service can trust its arguments. Every
 * rejection is a 400 with the documented error shape and a `details` array naming the
 * field — docs/API.md#error-shape.
 *
 * Express 5 forwards async rejections to the error middleware, so these throw rather than
 * catching and calling next().
 */

import * as service from './service.js';
import { validationFailed, notFound } from '../../platform/index.js';

/** Parse a bounded positive integer, collecting a problem rather than throwing per-field. */
function intParam(raw, { field, min = 1, max = Number.MAX_SAFE_INTEGER, fallback }, problems) {
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(String(raw))) {
    problems.push({ field, issue: 'must be a positive integer' });
    return fallback;
  }
  const n = Number(raw);
  if (n < min || n > max) {
    // Don't print MAX_SAFE_INTEGER at a caller — it reads as a bug, not a bound.
    const bounded = max !== Number.MAX_SAFE_INTEGER;
    problems.push({
      field,
      issue: bounded ? `must be between ${min} and ${max}` : `must be at least ${min}`,
    });
    return fallback;
  }
  return n;
}

export function listProducts(req, res) {
  const problems = [];
  const q = req.query;

  const page = intParam(q.page, { field: 'page', fallback: 1 }, problems);
  const limit = intParam(
    q.limit,
    { field: 'limit', max: service.MAX_LIMIT, fallback: service.DEFAULT_LIMIT },
    problems,
  );
  const minPrice = intParam(q.min_price, { field: 'min_price', min: 0, fallback: null }, problems);
  const maxPrice = intParam(q.max_price, { field: 'max_price', min: 0, fallback: null }, problems);

  const sort = q.sort ?? service.DEFAULT_SORT;
  if (!Object.hasOwn(service.SORT, sort)) {
    problems.push({
      field: 'sort',
      issue: `must be one of: ${Object.keys(service.SORT).join(', ')}`,
    });
  }

  const category = q.category ?? null;
  if (category && !service.categoryExists(category)) {
    problems.push({ field: 'category', issue: 'unknown category slug' });
  }

  const search = typeof q.q === 'string' && q.q.trim() ? q.q.trim().slice(0, 100) : null;

  let slugs = null;
  if (q.slugs) {
    slugs = String(q.slugs).split(',').map((v) => v.trim()).filter(Boolean);
    if (slugs.length > service.MAX_SLUGS) {
      problems.push({ field: 'slugs', issue: `no more than ${service.MAX_SLUGS} at a time` });
      slugs = slugs.slice(0, service.MAX_SLUGS);
    }
  }

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    problems.push({ field: 'min_price', issue: 'must not exceed max_price' });
  }

  if (problems.length) throw validationFailed(problems);

  res.json(
    service.listProducts({ page, limit, category, sort, search, minPrice, maxPrice, slugs }),
  );
}

export function listFeatured(req, res) {
  // Curated, not a filter: `?limit=8` would return an arbitrary eight and change the home
  // page whenever the catalogue is reordered. docs/API.md#get-apiproductsfeatured.
  res.json({ data: service.getFeatured() });
}

export function getProduct(req, res) {
  const product = service.getBySlug(req.params.slug);
  if (!product) throw notFound(`No product with slug "${req.params.slug}"`);
  res.json(product);
}

export function listCategories(req, res) {
  res.json({ data: service.listCategories() });
}
