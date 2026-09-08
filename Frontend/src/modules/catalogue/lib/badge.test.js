import { describe, it, expect } from 'vitest';
import { badgeFor } from './badge.js';

/**
 * Derived badges.
 *
 * Two stored badges were wrong when this replaced them: -30% on a pair that is -29%, and
 * -10% on a pair that is -13%. The rounding is therefore the point of this file, not a
 * detail of it.
 */

const NOW = new Date('2026-09-08T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;
const product = (over = {}) => ({
  price: 250_000_000,
  old_price: null,
  created_at: '2020-01-01',
  ...over,
});

describe('discount badges', () => {
  it('computes the percentage from the two prices', () => {
    expect(badgeFor(product({ price: 700, old_price: 1400 }), NOW)).toEqual({
      kind: 'discount',
      label: '-50%',
    });
  });

  it('rounds to the nearest whole percent', () => {
    // 2.5M against 3.5M is 28.57%. The stored badge claimed -30%.
    expect(badgeFor(product({ price: 250_000_000, old_price: 350_000_000 }), NOW).label).toBe(
      '-29%',
    );
    // 5.4M against 6.2M is 12.9%. The stored badge claimed -10%.
    expect(badgeFor(product({ price: 540_000_000, old_price: 620_000_000 }), NOW).label).toBe(
      '-13%',
    );
  });

  it('ignores an old price that is not actually higher', () => {
    // A "discount" that raises the price is data corruption, not an offer.
    expect(badgeFor(product({ price: 1000, old_price: 1000 }), NOW)).toBeNull();
    expect(badgeFor(product({ price: 1000, old_price: 900 }), NOW)).toBeNull();
  });

  it('ignores a null or zero old price', () => {
    expect(badgeFor(product({ old_price: null }), NOW)).toBeNull();
    expect(badgeFor(product({ old_price: 0 }), NOW)).toBeNull();
  });

  it('suppresses a discount that rounds to zero', () => {
    // A 0.4% cut would render "-0%", which reads as broken rather than as a small saving.
    expect(badgeFor(product({ price: 996, old_price: 1000 }), NOW)).toBeNull();
  });
});

describe('new badges', () => {
  it('marks a product created inside the window', () => {
    const created = new Date(NOW - 5 * DAY).toISOString();
    expect(badgeFor(product({ created_at: created }), NOW)).toEqual({ kind: 'new', label: 'New' });
  });

  it('drops it once the window has passed', () => {
    const created = new Date(NOW - 31 * DAY).toISOString();
    expect(badgeFor(product({ created_at: created }), NOW)).toBeNull();
  });

  it('treats the boundary as inside, not outside', () => {
    // Exactly 30 days is still new; 30 days and a millisecond is not.
    expect(badgeFor(product({ created_at: new Date(NOW - 30 * DAY + 1).toISOString() }), NOW))
      .not.toBeNull();
    expect(badgeFor(product({ created_at: new Date(NOW - 30 * DAY).toISOString() }), NOW))
      .toBeNull();
  });

  it('does not mark a product dated in the future', () => {
    // A bad import with tomorrow's date should not be permanently "New".
    const future = new Date(NOW + 5 * DAY).toISOString();
    expect(badgeFor(product({ created_at: future }), NOW)).toBeNull();
  });

  it('ignores an unparseable date', () => {
    expect(badgeFor(product({ created_at: 'not a date' }), NOW)).toBeNull();
  });
});

describe('precedence and guards', () => {
  it('prefers a discount over newness', () => {
    // Both apply; the discount is the stronger reason to click.
    const both = product({ price: 700, old_price: 1400, created_at: new Date(NOW).toISOString() });
    expect(badgeFor(both, NOW).kind).toBe('discount');
  });

  it('returns null for a missing product rather than throwing', () => {
    expect(badgeFor(null, NOW)).toBeNull();
    expect(badgeFor(undefined, NOW)).toBeNull();
  });

  it('returns null when there is nothing to derive from', () => {
    expect(badgeFor({}, NOW)).toBeNull();
  });
});
