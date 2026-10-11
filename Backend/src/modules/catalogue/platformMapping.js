import { evaluateAll } from './publishGate.js';

/** Match the products served by the repository, including its publish gate. */
const publishedProducts = (catalogue) => evaluateAll(catalogue.products, {
  categoryNames: new Set(catalogue.categories),
}).publishable.filter((product) => product.discontinued !== true);

/** A blank mapping worksheet derived from the only product catalogue. */
export function platformMappingTemplate(catalogue) {
  return {
    provider: 'shopify',
    products: publishedProducts(catalogue).map(({ slug }) => ({
      slug,
      product_id: null,
      variant_id: null,
    })),
  };
}

/** Validate coverage and uniqueness before any platform checkout can use a mapping. */
export function validatePlatformMapping(catalogue, mapping) {
  if (!mapping || mapping.provider !== 'shopify' || !Array.isArray(mapping.products)) {
    throw new Error('Mapping needs provider "shopify" and products array');
  }
  if (Object.keys(mapping).sort().join(',') !== 'products,provider') {
    throw new Error('Mapping contains unexpected top-level fields');
  }
  const expected = new Set(publishedProducts(catalogue).map(({ slug }) => slug));
  const seenSlugs = new Set();
  const seenVariants = new Set();
  for (const row of mapping.products) {
    if (!row || Object.keys(row).sort().join(',') !== 'product_id,slug,variant_id') {
      throw new Error('Each mapping row needs slug, product_id and variant_id only');
    }
    if (!expected.has(row.slug) || seenSlugs.has(row.slug)) {
      throw new Error(`Unknown or duplicate slug: ${row.slug}`);
    }
    for (const field of ['product_id', 'variant_id']) {
      if (typeof row[field] !== 'string' || !row[field].trim() || row[field] !== row[field].trim()) {
        throw new Error(`Invalid ${field} for ${row.slug}`);
      }
    }
    if (!/^gid:\/\/shopify\/Product\/[1-9]\d*$/.test(row.product_id)) {
      throw new Error(`Invalid Shopify product_id for ${row.slug}`);
    }
    if (!/^gid:\/\/shopify\/ProductVariant\/[1-9]\d*$/.test(row.variant_id)) {
      throw new Error(`Invalid Shopify variant_id for ${row.slug}`);
    }
    if (seenVariants.has(row.variant_id)) {
      throw new Error(`Duplicate variant_id: ${row.variant_id}`);
    }
    seenSlugs.add(row.slug);
    seenVariants.add(row.variant_id);
  }
  const missing = [...expected].filter((slug) => !seenSlugs.has(slug));
  if (missing.length) throw new Error(`Missing mapping for: ${missing.join(', ')}`);
  return mapping.products.length;
}
