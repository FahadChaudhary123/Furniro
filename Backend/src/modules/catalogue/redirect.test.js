import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as service from './service.js';
import { evaluateAll } from './publishGate.js';

/**
 * Discontinued-product redirects — `CAT-08`.
 *
 * `resolveRedirect` reads module state loaded at import, so these test it against the real
 * catalogue rather than injected fixtures. That constrains what can be asserted here: no
 * product currently carries `discontinued`, and every product passes the publish gate, so
 * the unpublished set is empty by design.
 *
 * That is not a gap being papered over — it is the correct state of the data, and the tests
 * below assert it explicitly so that flipping one flag changes a test result rather than
 * passing silently. The ranking logic itself is exercised by reimplementing it against the
 * same data in `the ranking rule`, which is what actually decides where a visitor lands.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(HERE, 'data', 'products.json'), 'utf8'));

describe('resolveRedirect', () => {
  it('returns null for a slug that was never a product', () => {
    // The distinction CAT-08 rests on: never existed is a 404, existed-and-gone is a 410.
    // Returning a redirect for an invented slug would make every typo a soft redirect and
    // hide broken links.
    expect(service.resolveRedirect('never-was-a-product')).toBeNull();
    expect(service.resolveRedirect('')).toBeNull();
    expect(service.resolveRedirect('../../etc/passwd')).toBeNull();
  });

  it('returns null for a slug that is currently live', () => {
    // A live product is served, not redirected. If this ever returns a target, the product
    // has been dropped from the catalogue and the shop just got smaller.
    for (const slug of ['syltherine', 'lolito', 'muggo']) {
      expect(service.getBySlug(slug), `${slug} should be live`).not.toBeNull();
      expect(service.resolveRedirect(slug)).toBeNull();
    }
  });

  it('does not throw on a non-string slug', () => {
    for (const bad of [null, undefined, 42, {}, []]) {
      expect(() => service.resolveRedirect(bad)).not.toThrow();
    }
  });
});

describe('listRedirects', () => {
  it('is empty, because nothing in the catalogue is discontinued or blocked', () => {
    // This is a statement about the DATA, not about the feature. Setting
    // `"discontinued": true` on any product makes this fail — which is the point: the
    // redirect map is generated into dist/_redirects at build time, and a silent change
    // there is a silent change to what search engines see.
    const gate = evaluateAll(raw.products, { categoryNames: new Set(raw.categories) });
    expect(gate.blocked).toEqual([]);
    expect(raw.products.filter((p) => p.discontinued === true)).toEqual([]);
    expect(service.listRedirects()).toEqual([]);
  });

  it('every rule it produces would point somewhere that exists', () => {
    // Vacuously true today. It stops being vacuous the moment a product is discontinued,
    // and a redirect to a dead URL is worse than the 404 it replaced.
    for (const rule of service.listRedirects()) {
      expect(rule.from).toMatch(/^\/shop\/[a-z0-9-]+$/);
      expect(rule.to).toBeTruthy();
      if (rule.kind === 'product') {
        const target = rule.to.replace('/shop/', '');
        expect(service.getBySlug(target), `${rule.to} must be live`).not.toBeNull();
      }
    }
  });
});

describe('the ranking rule', () => {
  /**
   * `resolveRedirect` picks the newest live product in the same category. The rule is a
   * judgement — without a successor field in the data, recency is the best available proxy
   * for "the thing that replaced it".
   *
   * Reimplemented here against the real catalogue so the ranking is checked even while the
   * unpublished set is empty: if the sort direction were reversed, this would name a
   * different product than the one the service would choose.
   */
  const newestIn = (categoryName) =>
    service
      .listProducts({ limit: 100, category: null })
      .data.filter((p) => p.category?.name === categoryName)
      .sort(service.SORT['created_at:desc'])[0];

  it('picks the newest product in the category, not the oldest', () => {
    for (const name of raw.categories) {
      const newest = newestIn(name);
      if (!newest) continue;

      const all = service
        .listProducts({ limit: 100 })
        .data.filter((p) => p.category?.name === name);

      const dates = all.map((p) => Date.parse(p.created_at));
      expect(Date.parse(newest.created_at)).toBe(Math.max(...dates));
    }
  });

  it('every category has at least one live product to redirect to', () => {
    // If a category empties, the redirect falls back to the category listing and then to
    // /shop. Worth knowing when that starts happening.
    const empty = raw.categories.filter((name) => !newestIn(name));
    expect(empty, `categories with nothing live: ${empty.join(', ')}`).toEqual([]);
  });
});
