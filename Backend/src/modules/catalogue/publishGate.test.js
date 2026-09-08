import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluate, evaluateAll, ABSENT_FIELDS } from './publishGate.js';

/**
 * The publish gate (CAT-03).
 *
 * Every product in the catalogue currently passes, so without these the gate is a hundred
 * lines that have never rejected anything. These supply the broken products the real data
 * does not have.
 */

const CATEGORIES = new Set(['Living Room', 'Dining', 'Bedroom']);
const ctx = { categoryNames: CATEGORIES };

const good = (over = {}) => ({
  id: 1,
  slug: 'syltherine',
  name: 'Syltherine',
  description: 'Stylish cafe chair',
  category: 'Living Room',
  price: 250_000_000,
  old_price: 350_000_000,
  image: 'products/product1.jpg',
  created_at: '2025-11-04',
  ...over,
});

const ids = (list) => list.map((f) => f.id).sort();

describe('a complete product', () => {
  it('passes every rule', () => {
    const report = evaluate(good(), ctx);
    expect(report).toMatchObject({ slug: 'syltherine', publishable: true });
    expect(report.blocking).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it('passes with no old price at all', () => {
    // Absent is the common case and must not be reported as incomplete.
    expect(evaluate(good({ old_price: null }), ctx).warnings).toEqual([]);
    const { old_price: _omitted, ...without } = good();
    expect(evaluate(without, ctx).warnings).toEqual([]);
  });
});

describe('blocking rules', () => {
  it('blocks a missing or malformed slug', () => {
    for (const slug of [undefined, '', 'Not A Slug', 'trailing-', 'UPPER']) {
      const report = evaluate(good({ slug }), ctx);
      expect(report.publishable).toBe(false);
      expect(ids(report.blocking)).toContain('slug');
    }
  });

  it('blocks a blank name', () => {
    expect(evaluate(good({ name: '   ' }), ctx).publishable).toBe(false);
  });

  it('blocks a price that is not a positive integer', () => {
    // A float price is the money bug DATA_MODEL.md exists to prevent; a string renders NaN.
    for (const price of [0, -100, 12.5, '250000000', null, undefined, NaN]) {
      expect(evaluate(good({ price }), ctx).publishable).toBe(false);
    }
  });

  it('blocks a missing image', () => {
    expect(ids(evaluate(good({ image: '' }), ctx).blocking)).toContain('image');
  });

  it('blocks an unknown category', () => {
    // This is the shape that blanked /shop once. It must never be served again.
    expect(ids(evaluate(good({ category: 'Conservatory' }), ctx).blocking)).toContain('category');
  });

  it('reports every blocking failure at once, not just the first', () => {
    const report = evaluate({ slug: 'x', name: '', price: 0, image: '' }, ctx);
    expect(ids(report.blocking)).toEqual(['category', 'image', 'name', 'price']);
  });

  it('does not throw on null, undefined or a non-object', () => {
    for (const bad of [null, undefined, 42, 'product']) {
      expect(() => evaluate(bad, ctx)).not.toThrow();
      expect(evaluate(bad, ctx).publishable).toBe(false);
    }
    expect(evaluate(null, ctx).slug).toBe('(no slug)');
  });

  it('treats a missing context as no known categories rather than crashing', () => {
    expect(() => evaluate(good())).not.toThrow();
    expect(ids(evaluate(good()).blocking)).toContain('category');
  });
});

describe('warning rules', () => {
  it('warns but still publishes when the description is empty', () => {
    const report = evaluate(good({ description: '' }), ctx);
    expect(report.publishable).toBe(true);
    expect(ids(report.warnings)).toContain('description');
  });

  it('warns on an old price at or below the current price', () => {
    // Not blocking: the page renders. But the badge would claim a discount that raises
    // the price, so someone has to see it.
    expect(ids(evaluate(good({ old_price: 250_000_000 }), ctx).warnings)).toContain('old_price');
    expect(ids(evaluate(good({ old_price: 1000 }), ctx).warnings)).toContain('old_price');
  });

  it('warns on an unparseable creation date', () => {
    expect(ids(evaluate(good({ created_at: 'last tuesday' }), ctx).warnings)).toContain(
      'created_at',
    );
  });
});

describe('evaluateAll', () => {
  const catalogue = [good({ slug: 'a' }), good({ slug: 'b', category: 'Nowhere' }), good({ slug: 'c', description: '' })];

  it('partitions into publishable, blocked and warned', () => {
    const result = evaluateAll(catalogue, ctx);
    expect(result.publishable.map((p) => p.slug)).toEqual(['a', 'c']);
    expect(result.blocked.map((b) => b.report.slug)).toEqual(['b']);
    expect(result.warned.map((w) => w.report.slug)).toEqual(['c']);
  });

  it('never counts a blocked product as warned', () => {
    // Otherwise the report double-counts and the totals do not add up.
    const result = evaluateAll(catalogue, ctx);
    const blockedSlugs = new Set(result.blocked.map((b) => b.report.slug));
    expect(result.warned.some((w) => blockedSlugs.has(w.report.slug))).toBe(false);
    expect(result.publishable.length + result.blocked.length).toBe(catalogue.length);
  });

  it('handles an empty catalogue', () => {
    expect(evaluateAll([], ctx)).toMatchObject({ publishable: [], blocked: [], warned: [] });
  });
});

describe('the real catalogue', () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const raw = JSON.parse(readFileSync(join(HERE, 'data', 'products.json'), 'utf8'));

  it('publishes every shipped product', () => {
    // If this fails, the API is about to serve fewer products than the file contains.
    // `npm run completeness` names which and why.
    const result = evaluateAll(raw.products, { categoryNames: new Set(raw.categories) });
    expect(result.blocked.map((b) => b.report.slug)).toEqual([]);
    expect(result.publishable).toHaveLength(raw.products.length);
  });

  it('still has no product carrying the CAT-01 fields the report calls absent', () => {
    // Guards the report against going stale: add tax_class to a product and this fails,
    // which is the prompt to move it out of ABSENT_FIELDS into a real rule.
    for (const { id } of ABSENT_FIELDS) {
      expect(raw.products.some((p) => p[id] !== undefined)).toBe(false);
    }
  });
});
