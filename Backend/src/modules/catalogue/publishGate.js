/**
 * The publish gate — `CAT-03`.
 *
 * Doc B §15: an incomplete product is "checked by the publish gate, not by eye". This file
 * is that gate, and it is the single definition of what makes a product complete. Rules
 * live here rather than scattered through the repository, the API and a spreadsheet,
 * because three copies of a rule is three rules.
 *
 * Two severities, and the distinction matters:
 *
 *   BLOCKING  the product cannot render correctly. Serving it produces a broken card, a
 *             missing image or a NaN price in front of a customer. The repository drops it.
 *   WARNING   the product renders, but something needed to sell or index it is missing.
 *             It stays visible; the completeness report (`CAT-04`) lists it.
 *
 * Dropping a product from the catalogue is a heavier action than it looks — a slug that
 * silently vanishes is a 404 on an indexed URL, which is the exact failure §15 warns about.
 * So BLOCKING is reserved for products that would be visibly broken if shown, which is
 * worse. Everything else warns.
 *
 * Pure and dependency-free on purpose: no logging, no file access, no config. It is called
 * at module load, from a CLI report and from tests.
 */

/** Fields every renderable product must have, with the check each one has to pass. */
const BLOCKING_RULES = [
  {
    id: 'slug',
    describe: 'a URL slug',
    test: (p) => typeof p.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug),
    why: 'the product URL is built from it; a missing or malformed slug is an unreachable page',
  },
  {
    id: 'name',
    describe: 'a name',
    test: (p) => typeof p.name === 'string' && p.name.trim().length > 0,
    why: 'it is the card heading, the document title and the image alt text',
  },
  {
    id: 'price',
    describe: 'a price in integer minor units',
    test: (p) => Number.isInteger(p.price) && p.price > 0,
    why: 'a float or a string price renders as NaN and cannot be summed — see DATA_MODEL.md#money',
  },
  {
    id: 'image',
    describe: 'an image key',
    test: (p) => typeof p.image === 'string' && p.image.trim().length > 0,
    why: 'the client resolves this key to a hashed asset; without it the card has a hole',
  },
  {
    id: 'category',
    describe: 'a known category',
    test: (p, { categoryNames }) => categoryNames.has(p.category),
    why: 'an unknown category is unreachable by browsing and breaks the category filter counts',
  },
];

/** Present-and-sane checks that do not stop a product being shown. */
const WARNING_RULES = [
  {
    id: 'description',
    describe: 'a description',
    test: (p) => typeof p.description === 'string' && p.description.trim().length > 0,
    why: 'the detail page and every search snippet are empty without it',
  },
  {
    id: 'old_price',
    describe: 'an old price above the current price, or none at all',
    // `null`/absent is correct and common — only a present-but-wrong value is a problem.
    test: (p) => p.old_price == null || (Number.isInteger(p.old_price) && p.old_price > p.price),
    why: 'an old price at or below the current one renders a "discount" that raises the price',
  },
  {
    id: 'discount_expires_at',
    describe: 'a discount expiry that is either absent, in the future, or cleaned up',
    // PROMO-05: "none may promote an expired offer". The front end stops showing an expired
    // discount, which protects the customer — this is the other half: telling somebody the
    // data still claims an offer that ended, so it gets removed rather than lingering.
    test: (p) => {
      if (!p.discount_expires_at) return true;
      const at = new Date(p.discount_expires_at).getTime();
      return !Number.isNaN(at) && at > Date.now();
    },
    why: 'the offer has ended or its expiry is unreadable; clear old_price and the expiry',
  },
  {
    id: 'created_at',
    describe: 'a parseable creation date',
    test: (p) => typeof p.created_at === 'string' && !Number.isNaN(Date.parse(p.created_at)),
    why: 'the "New" badge is derived from it; an unparseable date silently suppresses the badge',
  },
];

/**
 * Fields `CAT-01` requires that no product currently carries. Reported separately so the
 * completeness report distinguishes "this product is worse than its peers" from "the
 * catalogue as a whole has never had this field" — a per-product list of 40 identical
 * failures is noise, and noise is how a report stops being read.
 */
export const ABSENT_FIELDS = [
  { id: 'tax_class', why: 'CAT-01; needed before checkout can compute tax' },
  { id: 'weight', why: 'CAT-01; needed before fulfilment can rate a shipment' },
  { id: 'seo_title', why: 'CAT-01; the detail page falls back to the product name' },
  { id: 'seo_description', why: 'CAT-01; no meta description is emitted' },
];

/**
 * Evaluate one product against every rule.
 *
 * @param {object} product raw product row, before category embedding
 * @param {{categoryNames: Set<string>}} context known category names
 * @returns {{slug: string, blocking: Array, warnings: Array, publishable: boolean}}
 */
export function evaluate(product, { categoryNames = new Set() } = {}) {
  const failures = (rules) =>
    rules
      .filter((rule) => {
        try {
          return !rule.test(product ?? {}, { categoryNames });
        } catch {
          // A rule that throws on malformed input is a failed rule, not a crashed gate.
          return true;
        }
      })
      .map(({ id, describe, why }) => ({ id, describe, why }));

  const blocking = failures(BLOCKING_RULES);

  return {
    slug: product?.slug ?? '(no slug)',
    blocking,
    warnings: failures(WARNING_RULES),
    publishable: blocking.length === 0,
  };
}

/**
 * Evaluate a whole catalogue.
 * @returns {{results: Array, publishable: Array, blocked: Array, warned: Array}}
 */
export function evaluateAll(products, context) {
  const results = products.map((p) => ({ product: p, report: evaluate(p, context) }));
  return {
    results,
    publishable: results.filter((r) => r.report.publishable).map((r) => r.product),
    blocked: results.filter((r) => !r.report.publishable),
    warned: results.filter((r) => r.report.publishable && r.report.warnings.length > 0),
  };
}

export const RULE_COUNT = BLOCKING_RULES.length + WARNING_RULES.length;
