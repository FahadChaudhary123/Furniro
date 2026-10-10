import { describe, expect, it } from 'vitest';

import { checkRenderRedirects } from './check-render-redirects.mjs';

const categories = ['Living Room'];
const products = [
  { slug: 'old-chair', name: 'Old chair', price: 100, image: 'old.jpg', category: 'Living Room', discontinued: true },
  { slug: 'new-chair', name: 'New chair', price: 100, image: 'new.jpg', category: 'Living Room', created_at: '2026-01-01' },
];
const blueprint = (rules) => `services:\n  - name: furniro-storefront\n    runtime: static\n    routes:\n${rules}`;
const redirect = '      - type: redirect\n        source: /shop/old-chair\n        destination: /shop/new-chair\n';
const blogRedirect = '      - type: redirect\n        source: /about\n        destination: /blog\n';
const rewrite = '      - type: rewrite\n        source: /*\n        destination: /index.html\n';

describe('Render catalogue redirects', () => {
  it('accepts a matching 301 before the SPA rewrite', () => {
    expect(checkRenderRedirects(products, categories, blueprint(blogRedirect + redirect + rewrite))).toBe(2);
  });

  it('blocks a discontinued product without a Render 301', () => {
    expect(() => checkRenderRedirects(products, categories, blueprint(blogRedirect + rewrite)))
      .toThrow('missing Render 301');
  });

  it('blocks a redirect behind the catch-all rewrite', () => {
    expect(() => checkRenderRedirects(products, categories, blueprint(blogRedirect + rewrite + redirect)))
      .toThrow('redirect must precede');
  });

  it('blocks a stale destination', () => {
    const wrong = redirect.replace('/shop/new-chair', '/shop/something-else');
    expect(() => checkRenderRedirects(products, categories, blueprint(blogRedirect + wrong + rewrite)))
      .toThrow('does not redirect');
  });

  it('blocks a missing legacy blog redirect', () => {
    expect(() => checkRenderRedirects(products, categories, blueprint(redirect + rewrite)))
      .toThrow('/about -> /blog: missing Render 301');
  });
});
