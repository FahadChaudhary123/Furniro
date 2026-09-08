import { describe, it, expect } from 'vitest';
import { formatPrice, toMinorUnits } from './money.js';

/**
 * Money formatting. The end-to-end suite checks a price *looks* right on a card; this
 * checks the arithmetic at the edges, where a rounding error hides.
 */

describe('toMinorUnits', () => {
  it('converts major to minor units', () => {
    expect(toMinorUnits(2_500_000)).toBe(250_000_000);
    expect(toMinorUnits(1)).toBe(100);
  });

  it('rounds rather than truncating', () => {
    // 0.1 * 100 is 10.000000000000002 in binary floating point. Math.trunc would give 10
    // here but 9 for other values — rounding is what keeps a cent from vanishing.
    expect(toMinorUnits(0.1)).toBe(10);
    expect(toMinorUnits(0.29)).toBe(29);
    expect(toMinorUnits(1.005)).toBe(101);
  });

  it('handles zero', () => {
    expect(toMinorUnits(0)).toBe(0);
  });
});

/**
 * Intl separates the symbol from the number with U+00A0, not a plain space.
 * Written as an escape rather than the literal character: an invisible byte in source is
 * one "tidy up" away from silently breaking these assertions.
 */
const NBSP = String.fromCharCode(0x00a0);
const plain = (str) => str.split(NBSP).join(' ');

describe('formatPrice', () => {
  it('formats rupiah with the Indonesian grouping', () => {
    expect(plain(formatPrice(250_000_000))).toBe('Rp 2.500.000');
    expect(plain(formatPrice(15_000_000))).toBe('Rp 150.000');
  });

  it('separates the symbol with a non-breaking space', () => {
    // Deliberate, and worth pinning: it stops a price wrapping between "Rp" and the digits.
    // Anything comparing against a literal plain space will not match — Playwright's
    // toHaveText normalises whitespace, which is why the browser tests never noticed.
    expect(formatPrice(250_000_000)).toBe(`Rp${NBSP}2.500.000`);
  });

  it('shows no decimal places', () => {
    // IDR has no minor unit in practice, so a trailing ",00" would be wrong on every price.
    expect(formatPrice(250_000_050)).not.toMatch(/,\d\d/);
  });

  it('formats zero rather than an empty string', () => {
    expect(plain(formatPrice(0))).toBe('Rp 0');
  });

  it('returns an empty string for anything that is not a finite number', () => {
    // A missing price must not render "NaN" or "undefined" on a product card.
    for (const bad of [undefined, null, NaN, Infinity, '2500000', {}]) {
      expect(formatPrice(bad)).toBe('');
    }
  });

  it('round-trips through toMinorUnits', () => {
    const reference = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    for (const major of [150_000, 500_000, 2_500_000, 13_500_000]) {
      expect(formatPrice(toMinorUnits(major))).toBe(reference.format(major));
    }
  });

  it('never emits a currency other than rupiah', () => {
    // A stray "Rs" on the struck-through old price shipped to production once.
    expect(formatPrice(100_000)).toMatch(/^Rp/);
    expect(formatPrice(100_000)).not.toMatch(/\bRs\b/);
  });
});
