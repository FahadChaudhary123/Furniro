import { expect, it, vi } from 'vitest';
import { createCheckoutQuote, validateDelivery } from './index.js';
const delivery = () => ({ recipientName: ' Test buyer ', phone: '+92 300 0000000', addressLine1: 'Synthetic address', city: 'Lahore', country: 'PK' });
const input = () => ({ items: [{ slug: 'test-chair', quantity: 2 }], delivery: delivery() });
const product = { slug: 'test-chair', name: 'Synthetic chair', price: 1000, currency: 'PKR' };
const charges = () => ({ discountMinor: 100, shippingMinor: 300, taxMinor: 200 });
const build = (options = {}) => createCheckoutQuote({ findProduct: () => product, calculateCharges: charges, ...options });

it('uses catalogue prices and explicit charges with normalized delivery', async () => {
  const policy = vi.fn(charges);
  const result = await build({ calculateCharges: policy })(input());
  expect(result.quote).toMatchObject({ currency: 'PKR', subtotalMinor: 2000, totalMinor: 2400,
    lines: [{ slug: 'test-chair', name: 'Synthetic chair', quantity: 2, unitPriceMinor: 1000 }] });
  expect(result.delivery.recipientName).toBe('Test buyer');
  expect(policy.mock.calls[0][0].subtotalMinor).toBe(2000);
  expect(Object.isFrozen(policy.mock.calls[0][0].lines[0])).toBe(true);
});
it('rejects browser money before pricing', async () => {
  const findProduct = vi.fn();
  for (const request of [{ ...input(), totalMinor: 1 }, { ...input(), items: [{ ...input().items[0], price: 1 }] }]) {
    await expect(build({ findProduct })(request)).rejects.toThrow('Unsupported');
  }
  expect(findProduct).not.toHaveBeenCalled();
});
it('rejects unavailable products and non-PKR prices', async () => {
  for (const value of [null, { ...product, currency: 'IDR' }, { ...product, slug: 'wrong' }]) {
    await expect(build({ findProduct: () => value })(input())).rejects.toThrow('unavailable');
  }
});
it('rejects invalid quantities, duplicates and oversized carts', async () => {
  for (const items of [[], Array(101).fill(input().items[0]), [...input().items, ...input().items],
    ...[0, 100, 1.5, '2'].map((quantity) => [{ slug: 'test-chair', quantity }])]) {
    await expect(build()({ ...input(), items })).rejects.toThrow();
  }
});
it('requires explicit valid charges and rejects unsafe totals', async () => {
  await expect(build({ calculateCharges: undefined })(input())).rejects.toThrow('not configured');
  for (const value of [null, {}, { ...charges(), taxMinor: 1.5 }, { ...charges(), shippingMinor: -1 },
    { ...charges(), discountMinor: 3000 }, { ...charges(), shippingMinor: Number.MAX_SAFE_INTEGER }]) {
    await expect(build({ calculateCharges: () => value })(input())).rejects.toThrow();
  }
  await expect(build({ findProduct: () => ({ ...product, price: Number.MAX_SAFE_INTEGER }) })(input())).rejects.toThrow('range');
});
it('propagates unsupported delivery areas', async () => {
  await expect(build({ calculateCharges: () => { throw new Error('Unsupported delivery area'); } })(input())).rejects.toThrow('Unsupported delivery area');
});
it('validates Pakistan delivery details', () => {
  for (const details of [{ ...delivery(), country: 'US' }, { ...delivery(), phone: 'invalid' },
    { ...delivery(), recipientName: ' ' }, { ...delivery(), city: 'private\nvalue' },
    { ...delivery(), addressLine1: 'x'.repeat(201) }, { ...delivery(), email: 'unused@example.test' }]) {
    expect(() => validateDelivery(details)).toThrow();
  }
  expect(validateDelivery(delivery())).toMatchObject({ postalCode: '', addressLine2: '', country: 'PK' });
});
