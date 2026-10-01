import { describe, expect, it } from 'vitest';
import { matchesProductQuery } from './searchQuery.js';

const chair = { name: 'Café Chair', description: 'Oak dining seat' };

describe('product query', () => {
  it('matches words across fields in either order', () => {
    expect(matchesProductQuery(chair, 'dining chair')).toBe(true);
    expect(matchesProductQuery(chair, 'chair oak')).toBe(true);
  });

  it('ignores case and accents', () => {
    expect(matchesProductQuery(chair, 'CAFE')).toBe(true);
  });

  it('requires every word and does not match absent terms', () => {
    expect(matchesProductQuery(chair, 'chair sofa')).toBe(false);
    expect(matchesProductQuery(chair, '   ')).toBe(true);
  });
});
