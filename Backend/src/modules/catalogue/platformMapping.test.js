import { describe, expect, it } from 'vitest';
import { platformMappingTemplate, validatePlatformMapping } from './platformMapping.js';

const product = (slug, extra = {}) => ({
  slug, name: slug, price: 100, image: `${slug}.jpg`, category: 'Living Room', ...extra,
});
const catalogue = {
  categories: ['Living Room'],
  products: [product('chair'), product('table'), product('old-chair', { discontinued: true }),
    product('broken-chair', { image: null })],
};
const mapping = {
  provider: 'shopify',
  products: [
    { slug: 'chair', product_id: 'gid://shopify/Product/1', variant_id: 'gid://shopify/ProductVariant/11' },
    { slug: 'table', product_id: 'gid://shopify/Product/2', variant_id: 'gid://shopify/ProductVariant/22' },
  ],
};

describe('platform mapping', () => {
  it('makes a blank worksheet without product prices', () => {
    expect(platformMappingTemplate(catalogue)).toEqual({
      provider: 'shopify',
      products: [
        { slug: 'chair', product_id: null, variant_id: null },
        { slug: 'table', product_id: null, variant_id: null },
      ],
    });
  });

  it('requires complete, unique variant coverage', () => {
    expect(validatePlatformMapping(catalogue, mapping)).toBe(2);
    expect(() => validatePlatformMapping(catalogue, {
      ...mapping, products: mapping.products.slice(0, 1),
    })).toThrow('Missing mapping');
    expect(() => validatePlatformMapping(catalogue, {
      ...mapping, products: [mapping.products[0], { ...mapping.products[1], variant_id: mapping.products[0].variant_id }],
    })).toThrow('Duplicate variant_id');
  });

  it('rejects IDs that Shopify cannot use as products or cart variants', () => {
    expect(() => validatePlatformMapping(catalogue, { ...mapping, provider: 'example' }))
      .toThrow('provider "shopify"');
    expect(() => validatePlatformMapping(catalogue, {
      ...mapping, products: [{ ...mapping.products[0], product_id: '123' }, mapping.products[1]],
    })).toThrow('Invalid Shopify product_id');
    expect(() => validatePlatformMapping(catalogue, {
      ...mapping, products: [{ ...mapping.products[0], variant_id: 'gid://shopify/Product/11' }, mapping.products[1]],
    })).toThrow('Invalid Shopify variant_id');
  });

  it('excludes discontinued and blocked products from required mapping', () => {
    expect(platformMappingTemplate(catalogue).products.map(({ slug }) => slug))
      .toEqual(['chair', 'table']);
    expect(() => validatePlatformMapping(catalogue, {
      ...mapping,
      products: [...mapping.products, { slug: 'old-chair', product_id: 'p3', variant_id: 'v3' }],
    })).toThrow('Unknown or duplicate slug: old-chair');
    expect(() => validatePlatformMapping(catalogue, {
      ...mapping,
      products: [...mapping.products, { slug: 'broken-chair', product_id: 'p4', variant_id: 'v4' }],
    })).toThrow('Unknown or duplicate slug: broken-chair');
  });
});
