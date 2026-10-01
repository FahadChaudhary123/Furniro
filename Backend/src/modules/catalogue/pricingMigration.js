import { evaluateAll } from './publishGate.js';

/** Blank worksheet; no IDR amount is suggested as a PKR price. */
export function pkrTemplate(catalogue) {
  return {
    currency: 'PKR',
    products: catalogue.products.map(({ slug }) => ({
      slug,
      price_minor: null,
      old_price_minor: null,
    })),
  };
}

/** Validate the entire proposal before replacing any catalogue amount. */
export function buildPkrCatalogue(catalogue, proposal) {
  if (catalogue.currency !== 'IDR') throw new Error('Expected the current IDR catalogue');
  if (!proposal || proposal.currency !== 'PKR' || !Array.isArray(proposal.products)) {
    throw new Error('Proposal must declare PKR and a products array');
  }
  if (Object.keys(proposal).sort().join(',') !== 'currency,products') {
    throw new Error('Proposal contains unexpected top-level fields');
  }

  const expected = new Set(catalogue.products.map(({ slug }) => slug));
  const prices = new Map();
  for (const row of proposal.products) {
    if (!row || Object.keys(row).sort().join(',') !== 'old_price_minor,price_minor,slug') {
      throw new Error('Each proposal row needs slug, price_minor and old_price_minor only');
    }
    if (!expected.has(row.slug) || prices.has(row.slug)) {
      throw new Error(`Unknown or duplicate product slug: ${row.slug}`);
    }
    if (!Number.isSafeInteger(row.price_minor) || row.price_minor <= 0) {
      throw new Error(`Invalid PKR price for ${row.slug}`);
    }
    if (row.old_price_minor !== null &&
      (!Number.isSafeInteger(row.old_price_minor) || row.old_price_minor <= row.price_minor)) {
      throw new Error(`Invalid PKR old price for ${row.slug}`);
    }
    prices.set(row.slug, row);
  }
  if (prices.size !== expected.size) {
    const missing = [...expected].filter((slug) => !prices.has(slug));
    throw new Error(`Missing PKR prices for: ${missing.join(', ')}`);
  }

  const next = {
    ...catalogue,
    currency: 'PKR',
    products: catalogue.products.map((product) => {
      const row = prices.get(product.slug);
      const updated = { ...product, price: row.price_minor, old_price: row.old_price_minor };
      if (row.old_price_minor === null) delete updated.discount_expires_at;
      return updated;
    }),
  };
  const gate = evaluateAll(next.products, { categoryNames: new Set(next.categories) });
  if (gate.blocked.length || gate.warned.length) {
    throw new Error('PKR proposal does not pass the product publish gate');
  }
  return next;
}
