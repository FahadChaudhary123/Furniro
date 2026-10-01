import { describe, expect, it } from 'vitest';
import { platformMappingTemplate, validatePlatformMapping } from './platformMapping.js';

const catalogue = { products: [{ slug: 'chair' }, { slug: 'table' }] };
const mapping = {
  provider: 'example',
  products: [
    { slug: 'chair', product_id: 'p1', variant_id: 'v1' },
    { slug: 'table', product_id: 'p2', variant_id: 'v2' },
  ],
};

describe('platform mapping', () => {
  it('makes a blank worksheet without product prices', () => {
    expect(platformMappingTemplate(catalogue)).toEqual({
      provider: null,
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
      ...mapping, products: [mapping.products[0], { ...mapping.products[1], variant_id: 'v1' }],
    })).toThrow('Duplicate variant_id');
  });
});
