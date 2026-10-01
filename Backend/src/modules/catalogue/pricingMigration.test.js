import { describe, it, expect } from 'vitest';
import { buildPkrCatalogue, pkrTemplate } from './pricingMigration.js';

const catalogue = {
  currency: 'IDR',
  categories: ['Living Room'],
  featured: ['chair'],
  products: [
    {
      slug: 'chair', name: 'Chair', description: 'A chair', image: 'products/chair.jpg',
      category: 'Living Room', price: 100_000_000, old_price: 150_000_000,
      created_at: '2025-01-01', discount_expires_at: '2099-01-01',
    },
    {
      slug: 'sofa', name: 'Sofa', description: 'A sofa', image: 'products/sofa.jpg',
      category: 'Living Room', price: 200_000_000, old_price: null,
      created_at: '2025-01-01',
    },
  ],
};
const approved = {
  currency: 'PKR',
  products: [
    { slug: 'chair', price_minor: 12_500_000, old_price_minor: null },
    { slug: 'sofa', price_minor: 24_000_050, old_price_minor: 25_000_000 },
  ],
};

describe('PKR price migration', () => {
  it('prints a blank worksheet without suggesting the IDR amounts', () => {
    const template = pkrTemplate(catalogue);
    expect(template.currency).toBe('PKR');
    expect(template.products).toEqual([
      { slug: 'chair', price_minor: null, old_price_minor: null },
      { slug: 'sofa', price_minor: null, old_price_minor: null },
    ]);
  });

  it('changes all prices and currency together, preserving other product data', () => {
    const next = buildPkrCatalogue(catalogue, approved);
    expect(next.currency).toBe('PKR');
    expect(next.products.map(({ price, old_price }) => [price, old_price])).toEqual([
      [12_500_000, null], [24_000_050, 25_000_000],
    ]);
    expect(next.products[0].discount_expires_at).toBeUndefined();
    expect(next.products[0].image).toBe(catalogue.products[0].image);
    expect(catalogue.currency).toBe('IDR');
    expect(catalogue.products[0].price).toBe(100_000_000);
  });

  it('rejects missing, duplicate and unknown products', () => {
    expect(() => buildPkrCatalogue(catalogue, {
      ...approved, products: approved.products.slice(0, 1),
    })).toThrow(/Missing PKR prices for: sofa/);
    expect(() => buildPkrCatalogue(catalogue, {
      ...approved, products: [...approved.products, approved.products[0]],
    })).toThrow(/duplicate product slug/);
    expect(() => buildPkrCatalogue(catalogue, {
      ...approved, products: [{ ...approved.products[0], slug: 'other' }, approved.products[1]],
    })).toThrow(/Unknown or duplicate/);
  });

  it('rejects incomplete or invalid money fields', () => {
    for (const price_minor of [null, '12500000', 1.5, 0, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => buildPkrCatalogue(catalogue, {
        ...approved, products: [{ ...approved.products[0], price_minor }, approved.products[1]],
      })).toThrow(/Invalid PKR price/);
    }
    expect(() => buildPkrCatalogue(catalogue, {
      ...approved, products: [{ ...approved.products[0], old_price_minor: 1 }, approved.products[1]],
    })).toThrow(/Invalid PKR old price/);
    expect(() => buildPkrCatalogue(catalogue, {
      ...approved, products: [{ slug: 'chair', price_minor: 12_500_000 }, approved.products[1]],
    })).toThrow(/needs slug/);
  });

  it('rejects wrong currencies and unexpected fields', () => {
    expect(() => buildPkrCatalogue(catalogue, { ...approved, currency: 'IDR' }))
      .toThrow(/declare PKR/);
    expect(() => buildPkrCatalogue({ ...catalogue, currency: 'PKR' }, approved))
      .toThrow(/current IDR/);
    expect(() => buildPkrCatalogue(catalogue, { ...approved, exchange_rate: 1 }))
      .toThrow(/unexpected top-level/);
  });
});
