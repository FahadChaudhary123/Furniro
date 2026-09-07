import { useEffect, useMemo, useState, useCallback } from 'react';
import { CartContext } from './context.js';
import { useCartProducts } from './useCartProducts.js';
import * as storage from './storage.js';

/**
 * Cart state.
 *
 * This is the first shared state in the app, and it is shared for the reason
 * docs/ARCHITECTURE.md#state predicted: the navbar badge reads it and every product card
 * writes it, and those are cousins in the tree with no common owner but the root. Context
 * rather than a state library — there is one store, no server mutations to coordinate and
 * no cache to invalidate.
 *
 * Lines hold `{ slug, quantity }`. Product detail is hydrated from the API on every load,
 * so the cart cannot display a stale price.
 */

export function CartProvider({ children }) {
  const [lines, setLines] = useState(() => storage.loadCart());

  // Persist on every change. Storage failures are swallowed by the storage layer.
  useEffect(() => {
    storage.saveCart(lines);
  }, [lines]);

  // Re-read product detail whenever the set of slugs changes. Quantity changes do not
  // refetch — only which products are in the cart matters.
  const slugKey = useMemo(
    () => lines.map((l) => l.slug).sort().join(','),
    [lines],
  );

  const hydration = useCartProducts(slugKey);

  const add = useCallback((slug, quantity = 1) => {
    setLines((prev) => storage.addLine(prev, slug, quantity));
  }, []);

  const setQuantity = useCallback((slug, quantity) => {
    setLines((prev) => storage.setLineQuantity(prev, slug, quantity));
  }, []);

  const remove = useCallback((slug) => {
    setLines((prev) => storage.removeLine(prev, slug));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  /**
   * Lines joined to their products. A line whose product no longer exists is dropped —
   * a discontinued product should not sit in a cart as an unbuyable ghost.
   */
  const items = useMemo(() => {
    const bySlug = new Map(hydration.products.map((p) => [p.slug, p]));
    return lines
      .map((line) => {
        const product = bySlug.get(line.slug);
        return product
          ? { ...line, product, lineTotal: product.price * line.quantity }
          : null;
      })
      .filter(Boolean);
  }, [lines, hydration.products]);

  const value = useMemo(
    () => ({
      lines,
      items,
      // Count reads from `lines`, not `items`, so the badge is correct before hydration.
      count: lines.reduce((n, l) => n + l.quantity, 0),
      // Subtotal reads from `items`, because it needs server prices. It is a display figure:
      // the order total is computed server-side at checkout and never sent from here.
      subtotal: items.reduce((n, i) => n + i.lineTotal, 0),
      hydrating: hydration.hydrating,
      error: hydration.error,
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, items, hydration.hydrating, hydration.error, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

