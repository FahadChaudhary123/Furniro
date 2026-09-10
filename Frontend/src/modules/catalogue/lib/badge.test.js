import { describe, it, expect } from 'vitest';
import { badgeFor, discountFor } from './badge.js';

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

describe('discountFor — promotional expiry (PROMO-05)', () => {
  const NOW_MS = NOW;
  const withExpiry = (expiresAt) =>
    product({ price: 700, old_price: 1400, discount_expires_at: expiresAt });

  it('is live when there is no expiry at all', () => {
    // Absent means no expiry — exactly the behaviour before this existed. Seven of the forty
    // shipped products are in this state, and none of them changed.
    expect(discountFor(product({ price: 700, old_price: 1400 }), NOW_MS)).toEqual({
      oldPrice: 1400,
      percent: 50,
    });
  });

  it('is live before the expiry', () => {
    expect(discountFor(withExpiry('2026-12-31T00:00:00Z'), NOW_MS)).toMatchObject({ percent: 50 });
  });

  it('is gone after the expiry', () => {
    expect(discountFor(withExpiry('2026-01-01T00:00:00Z'), NOW_MS)).toBeNull();
  });

  it('treats the moment of expiry as expired, not as the last live second', () => {
    const exact = new Date(NOW_MS).toISOString();
    expect(discountFor(withExpiry(exact), NOW_MS)).toBeNull();
    expect(discountFor(withExpiry(new Date(NOW_MS + 1).toISOString()), NOW_MS)).not.toBeNull();
  });

  it('treats an unparseable expiry as expired', () => {
    // The alternative is promoting an offer whose end date nobody can read, which is the
    // failure this requirement names.
    expect(discountFor(withExpiry('next tuesday'), NOW_MS)).toBeNull();
    expect(discountFor(withExpiry(''), NOW_MS)).toEqual({ oldPrice: 1400, percent: 50 });
  });

  it('never returns a discount that is not really one', () => {
    expect(discountFor(product({ price: 1000, old_price: 1000 }), NOW_MS)).toBeNull();
    expect(discountFor(product({ price: 1000, old_price: 900 }), NOW_MS)).toBeNull();
    expect(discountFor(product({ price: 996, old_price: 1000 }), NOW_MS)).toBeNull();
    expect(discountFor(null, NOW_MS)).toBeNull();
  });
});

describe('the badge and the struck-through price agree', () => {
  /**
   * They are two halves of one promise. Before `discountFor` they were decided separately,
   * in four places — so hiding an expired badge would have left three components still
   * displaying "was Rp 3.500.000", which is precisely what PROMO-05 forbids.
   */
  const cases = [
    ['no expiry', undefined],
    ['future expiry', '2026-12-31T00:00:00Z'],
    ['past expiry', '2026-01-01T00:00:00Z'],
    ['unparseable expiry', 'soon'],
  ];

  for (const [name, expiresAt] of cases) {
    it(`${name}: a discount badge appears if and only if an old price is shown`, () => {
      const p = product({ price: 700, old_price: 1400, discount_expires_at: expiresAt });
      const badge = badgeFor(p, NOW);
      const discount = discountFor(p, NOW);

      expect(Boolean(discount)).toBe(badge?.kind === 'discount');
      if (discount) expect(badge.label).toBe(`-${discount.percent}%`);
    });
  }

  it('an expired discount falls back to the New badge rather than showing nothing wrong', () => {
    // Expiry removes the discount claim; it does not remove the product's other qualities.
    const fresh = product({
      price: 700,
      old_price: 1400,
      discount_expires_at: '2026-01-01T00:00:00Z',
      created_at: new Date(NOW - 5 * DAY).toISOString(),
    });
    expect(discountFor(fresh, NOW)).toBeNull();
    expect(badgeFor(fresh, NOW)).toEqual({ kind: 'new', label: 'New' });
  });
});
