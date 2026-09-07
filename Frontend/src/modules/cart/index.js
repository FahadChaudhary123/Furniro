/**
 * Cart module — public interface.
 *
 * Import only from here. See docs/MODULES.md#boundary-rules.
 *
 * Scope: a guest cart (`CART-01`). Still unbuilt, and each blocked on another module:
 *   CART-02  survives a failed payment      — needs `payments`
 *   CART-03  stock reservation              — needs `inventory`
 *   CART-04  90-day retention, purged       — needs a server-side cart and `jobs`
 *   CART-05  follows the customer           — needs `identity`
 */

export { CartProvider } from './CartProvider.jsx';
export { useCart } from './useCart.js';
export { MAX_LINE_QUANTITY } from './storage.js';
