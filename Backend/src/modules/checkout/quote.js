import { getBySlug } from '../catalogue/index.js';
import { prepareQuote } from './service.js';

function fields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error('Unsupported checkout fields');
  }
}

function text(value, max, optional = false) {
  if (optional && value === undefined) return '';
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/u.test(value) ||
      (!optional && !value.trim())) throw new Error('Invalid delivery details');
  return value.trim();
}

/** Shape validation only: this does not verify a phone number or delivery coverage. */
export function validateDelivery(input) {
  fields(input, ['recipientName', 'phone', 'addressLine1', 'addressLine2', 'city', 'postalCode', 'country']);
  if (input.country !== 'PK') throw new Error('Delivery must be within Pakistan');
  const phone = text(input.phone, 30);
  if (!/^\+?[0-9 ()-]{7,30}$/.test(phone) || phone.replace(/\D/g, '').length < 7) {
    throw new Error('Invalid delivery phone');
  }
  return Object.freeze({
    recipientName: text(input.recipientName, 100), phone,
    addressLine1: text(input.addressLine1, 200), addressLine2: text(input.addressLine2, 200, true),
    city: text(input.city, 100), postalCode: text(input.postalCode, 20, true), country: 'PK',
  });
}

/** Internal preparation only. Charge policy must be trusted server configuration. */
export function createCheckoutQuote({ findProduct = getBySlug, calculateCharges } = {}) {
  return async (input) => {
    fields(input, ['items', 'delivery']);
    const delivery = validateDelivery(input.delivery);
    if (!Array.isArray(input.items) || !input.items.length || input.items.length > 100) {
      throw new Error('Supply between 1 and 100 cart lines');
    }
    const seen = new Set();
    // Validate every line before looking up products or calling the charge policy.
    const items = input.items.map((item) => {
      fields(item, ['slug', 'quantity']);
      if (typeof item.slug !== 'string' || item.slug.length > 200 ||
          !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(item.slug) || seen.has(item.slug) ||
          !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
        throw new Error('Invalid or duplicate cart line');
      }
      seen.add(item.slug);
      return { slug: item.slug, quantity: item.quantity };
    });
    const lines = [];
    for (const item of items) {
      const product = await findProduct(item.slug);
      if (!product || product.slug !== item.slug || product.currency !== 'PKR') {
        throw new Error('Product is unavailable for PKR checkout');
      }
      lines.push({ ...item, name: product.name, unitPriceMinor: product.price });
    }
    const base = prepareQuote({ currency: 'PKR', lines, discountMinor: 0, shippingMinor: 0, taxMinor: 0 });
    if (typeof calculateCharges !== 'function') throw new Error('Shipping and tax policy is not configured');
    const policyLines = Object.freeze(base.lines.map((line) => Object.freeze(line)));
    const charges = await calculateCharges(Object.freeze({ lines: policyLines, delivery, subtotalMinor: base.subtotal }));
    fields(charges, ['discountMinor', 'shippingMinor', 'taxMinor']);
    const quote = { currency: 'PKR', lines: policyLines, ...charges };
    const prepared = prepareQuote(quote);
    return { delivery, quote: Object.freeze({ ...quote, subtotalMinor: prepared.subtotal, totalMinor: prepared.total }) };
  };
}
