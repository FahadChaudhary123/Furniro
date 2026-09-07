/**
 * Cart persistence.
 *
 * Stores ONLY `{ slug, quantity }` — never a price, a name or an image.
 *
 * That is the important decision here. A cart holding its own copy of a price is a cart
 * that shows yesterday's price after a repricing, and it is the same mistake as a client
 * submitting a total at checkout (docs/API.md#chk-06 reasoning). Line items are re-read
 * from GET /api/products on every load, so the server stays authoritative.
 *
 * localStorage is per-browser and per-device. A cart that follows the customer needs a
 * server-side cart keyed to an account — `CART-05`, blocked on `identity`.
 */

const KEY = 'furniro.cart.v1';
const MAX_QUANTITY = 99;

/** Every access is guarded: private windows, cleared site data and blocked storage all throw. */
function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Never trust what came out of storage — a user can edit it.
    return parsed
      .filter((l) => l && typeof l.slug === 'string' && Number.isInteger(l.quantity))
      .map((l) => ({ slug: l.slug, quantity: clamp(l.quantity) }))
      .filter((l) => l.quantity > 0);
  } catch {
    return [];
  }
}

function write(lines) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Storage full or blocked. The cart still works for this page view; it just will not
    // survive a reload. Failing silently beats breaking the page.
  }
  return lines;
}

const clamp = (n) => Math.max(0, Math.min(MAX_QUANTITY, Math.trunc(n)));

export const loadCart = read;

export const saveCart = write;

export function addLine(lines, slug, quantity = 1) {
  const existing = lines.find((l) => l.slug === slug);
  if (existing) {
    return lines.map((l) =>
      l.slug === slug ? { ...l, quantity: clamp(l.quantity + quantity) } : l,
    );
  }
  const q = clamp(quantity);
  return q > 0 ? [...lines, { slug, quantity: q }] : lines;
}

export function setLineQuantity(lines, slug, quantity) {
  const q = clamp(quantity);
  if (q === 0) return removeLine(lines, slug);
  return lines.map((l) => (l.slug === slug ? { ...l, quantity: q } : l));
}

export const removeLine = (lines, slug) => lines.filter((l) => l.slug !== slug);

export const MAX_LINE_QUANTITY = MAX_QUANTITY;
export const STORAGE_KEY = KEY;
