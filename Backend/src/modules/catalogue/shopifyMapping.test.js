import { describe, expect, it, vi } from 'vitest';
import { checkShopifyMapping, SHOPIFY_API_VERSION } from './shopifyMapping.js';

const catalogue = {
  currency: 'PKR', categories: ['Living Room'],
  products: [{ slug: 'chair', name: 'Chair', price: 12500050, image: 'chair.jpg', category: 'Living Room' }],
};
const mapping = { provider: 'shopify', products: [
  { slug: 'chair', product_id: 'gid://shopify/Product/1', variant_id: 'gid://shopify/ProductVariant/2' },
] };
const node = {
  __typename: 'ProductVariant', id: mapping.products[0].variant_id,
  product: { id: mapping.products[0].product_id },
  price: { amount: '125000.50', currencyCode: 'PKR' },
  availableForSale: true, image: { url: 'https://cdn.shopify.com/chair.jpg' },
};
const response = (payload) => new Response(JSON.stringify(payload), {
  headers: { 'X-Shopify-API-Version': SHOPIFY_API_VERSION },
});
const options = (fetchImpl) => ({ domain: 'furniro-test.myshopify.com', token: 'test-token', fetchImpl });

describe('Shopify mapping verification', () => {
  it('uses a read-only Pakistan query, private header and exact minor-unit price comparison', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ data: { nodes: [node] } }));
    expect(await checkShopifyMapping(catalogue, mapping, options(fetchImpl)))
      .toEqual({ checked: 1, issues: [] });
    const [url, request] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://furniro-test.myshopify.com/api/${SHOPIFY_API_VERSION}/graphql.json`);
    expect(request.headers['Shopify-Storefront-Private-Token']).toBe('test-token');
    expect(request.redirect).toBe('error');
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(request.body).query).toContain('@inContext(country: PK)');
    expect(JSON.parse(request.body).query).not.toContain('mutation');
  });

  it('blocks IDR prices and unsafe destinations before sending credentials', async () => {
    const fetchImpl = vi.fn();
    await expect(checkShopifyMapping({ ...catalogue, currency: 'IDR' }, mapping, options(fetchImpl)))
      .rejects.toThrow('approved PKR');
    for (const domain of ['https://store.myshopify.com', 'store.myshopify.com.evil.test', 'localhost', 'store.myshopify.com/path']) {
      await expect(checkShopifyMapping(catalogue, mapping, { ...options(fetchImpl), domain }))
        .rejects.toThrow('bare myshopify.com');
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [null, 'Variant missing'],
    [{ ...node, product: { id: 'gid://shopify/Product/99' } }, 'different product'],
    [{ ...node, price: { amount: '125000.51', currencyCode: 'PKR' } }, 'price does not match'],
    [{ ...node, price: { amount: '125000.50', currencyCode: 'IDR' } }, 'price does not match'],
    [{ ...node, price: { amount: '125000.501', currencyCode: 'PKR' } }, 'price does not match'],
    [{ ...node, availableForSale: false }, 'not available'],
    [{ ...node, image: null }, 'image is missing'],
  ])('reports mismatched or inaccessible provider data', async (variant, reason) => {
    const result = await checkShopifyMapping(catalogue, mapping,
      options(vi.fn().mockResolvedValue(response({ data: { nodes: [variant] } }))));
    expect(result.issues).toEqual([{ slug: 'chair', reason: expect.stringContaining(reason) }]);
  });

  it('rejects partial GraphQL data and does not expose remote error text', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({
      data: { nodes: [node] }, errors: [{ message: 'sensitive-remote-value' }],
    }));
    await expect(checkShopifyMapping(catalogue, mapping, options(fetchImpl)))
      .rejects.toThrow('Shopify returned errors or an incomplete mapping response');
  });

  it('sanitizes failed requests and rejects API version fallback', async () => {
    for (const fetchImpl of [
      vi.fn().mockRejectedValue(new Error('sensitive-token')),
      vi.fn().mockResolvedValue(new Response('sensitive-body', { status: 401 })),
      vi.fn().mockResolvedValue(new Response('{}', { headers: { 'X-Shopify-API-Version': '2027-01' } })),
    ]) {
      await expect(checkShopifyMapping(catalogue, mapping, options(fetchImpl)))
        .rejects.toThrow('Shopify read failed; check access, API version and connectivity');
    }
  });

  it('batches more than 250 variants within the API limit', async () => {
    const rows = Array.from({ length: 251 }, (_, index) => ({
      slug: `chair-${index}`, product_id: `gid://shopify/Product/${index + 1}`,
      variant_id: `gid://shopify/ProductVariant/${index + 1}`,
    }));
    const data = { ...catalogue, products: rows.map(({ slug }) => ({ ...catalogue.products[0], slug })) };
    const fetchImpl = vi.fn(async (_url, request) => {
      const { ids } = JSON.parse(request.body).variables;
      expect(ids.length).toBeLessThanOrEqual(250);
      return response({ data: { nodes: ids.map((id) => ({
        ...node, id, product: { id: rows.find((row) => row.variant_id === id).product_id },
      })) } });
    });
    expect(await checkShopifyMapping(data, { provider: 'shopify', products: rows }, options(fetchImpl)))
      .toEqual({ checked: 251, issues: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
