import { describe, expect, it } from 'vitest';
import { validateDeployConfig } from './check-deploy-config.mjs';

const valid = {
  VITE_API_URL: 'https://furniro-api.onrender.com/api',
  VITE_SITE_ORIGIN: 'https://furniro-storefront.onrender.com',
};

describe('Render public URL check', () => {
  it('accepts exact public URLs', () => {
    expect(() => validateDeployConfig(valid)).not.toThrow();
  });

  it.each([
    { VITE_API_URL: undefined },
    { VITE_API_URL: 'http://localhost:3100/api' },
    { VITE_API_URL: 'https://furniro-api.onrender.com/api/' },
    { VITE_SITE_ORIGIN: 'https://furniro.example.com' },
    { VITE_SITE_ORIGIN: 'https://furniro-storefront.onrender.com/' },
  ])('rejects invalid deployment values: %o', (change) => {
    expect(() => validateDeployConfig({ ...valid, ...change })).toThrow();
  });
});
