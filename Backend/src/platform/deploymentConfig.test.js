import { describe, expect, it } from 'vitest';
import { validateProductionOrigins } from './deploymentConfig.js';

describe('production origins', () => {
  it('accepts exact HTTPS origins', () => {
    expect(validateProductionOrigins('https://furniro.onrender.com')).toEqual(['https://furniro.onrender.com']);
  });

  it.each([undefined, '', 'http://localhost:5173', 'https://localhost:5173',
    'https://furniro.example.com',
    'https://furniro.onrender.com/path', 'https://furniro.onrender.com/',
    'https://furniro.onrender.com,https://furniro.onrender.com'])('rejects %s', (value) => {
    expect(() => validateProductionOrigins(value)).toThrow();
  });
});
