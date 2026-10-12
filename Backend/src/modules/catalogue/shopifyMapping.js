import { validatePlatformMapping } from './platformMapping.js';

export const SHOPIFY_API_VERSION = '2026-10';
const query = `query FurniroMapping($ids: [ID!]!) @inContext(country: PK) {
  nodes(ids: $ids) {
    __typename
    ... on ProductVariant {
      id
      product { id }
      price { amount currencyCode }
      availableForSale
      image { url }
    }
  }
}`;

// Shopify decimal strings become integer minor units without floating-point arithmetic.
function minorUnits(amount) {
  if (typeof amount !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(amount)) return null;
  const [whole, fraction = ''] = amount.split('.');
  const value = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
}

/** Read-only onboarding check. Does not certify inventory, payment or checkout readiness. */
export async function checkShopifyMapping(catalogue, mapping, {
  domain, token, fetchImpl = fetch,
}) {
  try {
    validatePlatformMapping(catalogue, mapping);
  } catch {
    throw new Error('Invalid local mapping; run npm run mapping -- --check first');
  }
  if (catalogue.currency !== 'PKR') {
    throw new Error('Apply approved PKR catalogue prices before checking Shopify');
  }
  const products = new Map(catalogue.products.map((product) => [product.slug, product]));
  if (mapping.products.some(({ slug }) => !Number.isSafeInteger(products.get(slug)?.price) ||
      products.get(slug).price <= 0)) {
    throw new Error('Mapped catalogue prices must be positive safe integers');
  }
  if (typeof domain !== 'string' ||
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/.test(domain)) {
    throw new Error('SHOPIFY_STORE_DOMAIN must be a bare myshopify.com store hostname');
  }
  if (typeof token !== 'string' || !token.trim() || /\s/.test(token)) {
    throw new Error('Set SHOPIFY_STOREFRONT_PRIVATE_TOKEN privately before checking Shopify');
  }

  const issues = [];
  let checked = 0;
  for (let offset = 0; offset < mapping.products.length; offset += 250) {
    const rows = mapping.products.slice(offset, offset + 250);
    let payload;
    try {
      const response = await fetchImpl(`https://${domain}/api/${SHOPIFY_API_VERSION}/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Shopify-Storefront-Private-Token': token },
        body: JSON.stringify({ query, variables: { ids: rows.map((row) => row.variant_id) } }),
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok || response.headers.get('X-Shopify-API-Version') !== SHOPIFY_API_VERSION) {
        throw new Error('Request failed');
      }
      payload = await response.json();
    } catch {
      // Do not echo remote bodies, URLs, headers or exceptions containing credentials.
      throw new Error('Shopify read failed; check access, API version and connectivity');
    }
    if (!payload || (payload.errors != null &&
        (!Array.isArray(payload.errors) || payload.errors.length > 0)) || !Array.isArray(payload.data?.nodes) ||
        payload.data.nodes.length !== rows.length) {
      throw new Error('Shopify returned errors or an incomplete mapping response');
    }
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const node = payload.data.nodes[index];
      checked += 1;
      if (node?.__typename !== 'ProductVariant' || node.id !== row.variant_id) {
        issues.push({ slug: row.slug, reason: 'Variant missing or inaccessible' });
        continue;
      }
      if (node.product?.id !== row.product_id) {
        issues.push({ slug: row.slug, reason: 'Variant belongs to a different product' });
      }
      if (node.price?.currencyCode !== 'PKR' ||
          minorUnits(node.price?.amount) !== products.get(row.slug).price) {
        issues.push({ slug: row.slug, reason: 'PKR selling price does not match catalogue' });
      }
      if (node.availableForSale !== true) {
        issues.push({ slug: row.slug, reason: 'Variant is not available for sale' });
      }
      if (typeof node.image?.url !== 'string' || !node.image.url.startsWith('https://')) {
        issues.push({ slug: row.slug, reason: 'Variant image is missing' });
      }
    }
  }
  return { checked, issues };
}
