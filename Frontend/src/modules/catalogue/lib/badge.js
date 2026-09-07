/**
 * Product badges are DERIVED, never stored.
 *
 * A stored "-30%" drifts from the prices it describes the moment either changes. That had
 * already happened in the old data: Syltherine was labelled -30% on a 2.5M/3.5M pair that
 * is actually -29%, and one shop row was labelled -10% on a genuine -13%.
 *
 * See docs/DATA_MODEL.md#resolution.
 */

const NEW_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {object} product - canonical product; needs price, old_price, created_at
 * @param {number} [now] - epoch ms, injectable so this is testable
 * @returns {{kind: 'discount'|'new', label: string} | null}
 */
export function badgeFor(product, now = Date.now()) {
  if (!product) return null;

  // A discount outranks newness: it is the stronger reason to click.
  if (product.old_price && product.old_price > product.price) {
    const off = Math.round((1 - product.price / product.old_price) * 100);
    if (off > 0) return { kind: 'discount', label: `-${off}%` };
  }

  if (product.created_at) {
    const age = now - new Date(product.created_at).getTime();
    if (age >= 0 && age < NEW_WINDOW_DAYS * DAY_MS) {
      return { kind: 'new', label: 'New' };
    }
  }

  return null;
}
