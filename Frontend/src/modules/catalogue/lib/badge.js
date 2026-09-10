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
 * Is this product's "was/now" claim live? — `PROMO-05`.
 *
 * Doc B §15: a campaign carries an expiry and **none may promote an expired offer**. A
 * struck-through old price is that claim, as much as any banner is, and it used to run
 * forever: seven of the forty products carry one, and the only way to end a promotion was to
 * edit the data.
 *
 * `discount_expires_at` is optional. **Absent means no expiry**, which is exactly today's
 * behaviour — this adds the ability to end a promotion, it does not invent one.
 *
 * The single source of truth for the whole claim, deliberately. The badge and the
 * struck-through price are two halves of the same promise; before this they were decided
 * separately, in four places, so hiding an expired badge would still have left three
 * components displaying "was Rp 3.500.000".
 *
 * @param {object} product
 * @param {number} [now] epoch ms, injectable for tests
 * @returns {{oldPrice: number, percent: number} | null}
 */
export function discountFor(product, now = Date.now()) {
  if (!product) return null;

  const { price, old_price: oldPrice, discount_expires_at: expiresAt } = product;
  if (!oldPrice || !(oldPrice > price)) return null;

  if (expiresAt) {
    const expiry = new Date(expiresAt).getTime();
    // An unparseable expiry is treated as expired. The alternative is to keep promoting an
    // offer whose end date nobody can read, which is the failure this requirement names.
    if (Number.isNaN(expiry) || now >= expiry) return null;
  }

  const percent = Math.round((1 - price / oldPrice) * 100);
  // A discount that rounds to zero reads as broken rather than as a small saving.
  return percent > 0 ? { oldPrice, percent } : null;
}

/**
 * @param {object} product - canonical product; needs price, old_price, created_at
 * @param {number} [now] - epoch ms, injectable so this is testable
 * @returns {{kind: 'discount'|'new', label: string} | null}
 */
export function badgeFor(product, now = Date.now()) {
  if (!product) return null;

  // A discount outranks newness: it is the stronger reason to click.
  const discount = discountFor(product, now);
  if (discount) return { kind: 'discount', label: `-${discount.percent}%` };

  if (product.created_at) {
    const age = now - new Date(product.created_at).getTime();
    if (age >= 0 && age < NEW_WINDOW_DAYS * DAY_MS) {
      return { kind: 'new', label: 'New' };
    }
  }

  return null;
}
