import { describe, it, expect } from 'vitest';
import { listProducts, getBySlug, listCategories, categoryExists, SORT, MAX_LIMIT } from './service.js';

/**
 * Catalogue business rules.
 *
 * The smoke suite proves the endpoint answers; this proves the arithmetic underneath it.
 * Pagination boundaries in particular are where an off-by-one hides — the last page, an
 * empty result, a page past the end.
 */

const TOTAL = 40;

describe('pagination', () => {
  it('defaults to the first page at the grid page size', () => {
    const { data, meta } = listProducts();
    expect(data).toHaveLength(16);
    expect(meta).toEqual({ page: 1, limit: 16, total: TOTAL, total_pages: 3 });
  });

  it('returns the remainder on the last page', () => {
    const { data, meta } = listProducts({ page: 3 });
    expect(data).toHaveLength(TOTAL - 32);
    expect(meta.total_pages).toBe(3);
  });

  it('returns nothing past the end without throwing', () => {
    expect(listProducts({ page: 99 }).data).toEqual([]);
  });

  it('reports at least one page even when a filter matches nothing', () => {
    // total_pages of 0 makes a pager render "page 1 of 0".
    const { data, meta } = listProducts({ search: 'zzzznothing' });
    expect(data).toEqual([]);
    expect(meta.total).toBe(0);
    expect(meta.total_pages).toBe(1);
  });

  it('divides exactly when the page size divides the total', () => {
    expect(listProducts({ limit: 20 }).meta.total_pages).toBe(2);
    expect(listProducts({ limit: 40 }).meta.total_pages).toBe(1);
  });

  it('pages do not overlap and cover everything', () => {
    const seen = [1, 2, 3].flatMap((page) => listProducts({ page }).data.map((p) => p.slug));
    expect(seen).toHaveLength(TOTAL);
    expect(new Set(seen).size).toBe(TOTAL);
  });
});

describe('sorting', () => {
  it('orders by price ascending and descending', () => {
    const asc = listProducts({ sort: 'price:asc', limit: MAX_LIMIT }).data.map((p) => p.price);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));

    const desc = listProducts({ sort: 'price:desc', limit: MAX_LIMIT }).data.map((p) => p.price);
    expect(desc).toEqual([...asc].reverse());
  });

  it('defaults to newest first', () => {
    const dates = listProducts({ limit: MAX_LIMIT }).data.map((p) => +new Date(p.created_at));
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('exposes only a closed set of sorts', () => {
    // A `sort` reaching an ORDER BY unchecked is the classic injection vector.
    expect(Object.keys(SORT)).toEqual([
      'created_at:desc', 'created_at:asc', 'price:asc', 'price:desc', 'name:asc', 'name:desc',
    ]);
  });

  it('leaves order untouched for an unknown sort rather than crashing', () => {
    // The controller rejects these; the service must still be safe if called directly.
    expect(listProducts({ sort: 'nonsense', limit: MAX_LIMIT }).data).toHaveLength(TOTAL);
  });

  it('does not mutate the underlying collection', () => {
    const before = listProducts({ limit: MAX_LIMIT }).data.map((p) => p.slug);
    listProducts({ sort: 'price:asc', limit: MAX_LIMIT });
    expect(listProducts({ limit: MAX_LIMIT }).data.map((p) => p.slug)).toEqual(before);
  });
});

describe('filtering', () => {
  it('filters by category slug', () => {
    const { data, meta } = listProducts({ category: 'living-room', limit: MAX_LIMIT });
    expect(meta.total).toBe(12);
    expect(data.every((p) => p.category.slug === 'living-room')).toBe(true);
  });

  it('searches name and description, case-insensitively', () => {
    const { data } = listProducts({ search: 'SOFA', limit: MAX_LIMIT });
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((p) => `${p.name} ${p.description}`.toLowerCase().includes('sofa'))).toBe(true);
  });

  it('applies a price range inclusively', () => {
    const min = 100_000_000;
    const max = 300_000_000;
    const { data } = listProducts({ minPrice: min, maxPrice: max, limit: MAX_LIMIT });
    expect(data.every((p) => p.price >= min && p.price <= max)).toBe(true);
  });

  it('combines filters conjunctively', () => {
    const { data } = listProducts({ category: 'bedroom', search: 'wardrobe', limit: MAX_LIMIT });
    expect(data.every((p) => p.category.slug === 'bedroom' && /wardrobe/i.test(p.name))).toBe(true);
  });

  it('looks products up by an exact slug list', () => {
    const { data } = listProducts({ slugs: ['syltherine', 'lolito'], limit: MAX_LIMIT });
    expect(data.map((p) => p.slug).sort()).toEqual(['lolito', 'syltherine']);
  });

  it('omits an unknown slug instead of failing', () => {
    // A discontinued product should drop out of a cart, not break it.
    const { data } = listProducts({ slugs: ['syltherine', 'gone'], limit: MAX_LIMIT });
    expect(data.map((p) => p.slug)).toEqual(['syltherine']);
  });
});

describe('lookups', () => {
  it('finds a product by slug', () => {
    expect(getBySlug('syltherine').name).toBe('Syltherine');
  });

  it('returns null for an unknown slug', () => {
    expect(getBySlug('nope')).toBeNull();
  });

  it('counts products per category, summing to the catalogue', () => {
    const categories = listCategories();
    expect(categories).toHaveLength(7);
    expect(categories.reduce((n, c) => n + c.product_count, 0)).toBe(TOTAL);
  });

  it('recognises only real category slugs', () => {
    expect(categoryExists('living-room')).toBe(true);
    expect(categoryExists('not-a-category')).toBe(false);
  });
});

describe('the shape the API returns', () => {
  it('embeds category as an object and stores no badge', () => {
    // Rendering the category object as a string is what blanked /shop once.
    const [product] = listProducts({ limit: 1 }).data;
    expect(typeof product.category).toBe('object');
    expect(product.category).toHaveProperty('name');
    expect(product).not.toHaveProperty('badge');
  });

  it('prices are integers, never formatted strings', () => {
    for (const p of listProducts({ limit: MAX_LIMIT }).data) {
      expect(Number.isInteger(p.price)).toBe(true);
      if (p.old_price !== null) expect(p.old_price).toBeGreaterThan(p.price);
    }
  });
});
