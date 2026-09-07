import { useContext } from 'react';
import { CartContext } from './context.js';

/**
 * Access the cart.
 *
 * Separate from CartContext.jsx because Fast Refresh only works when a module exports
 * components alone — mixing a hook in silently degrades reload behaviour in development.
 */
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside a <CartProvider>');
  return context;
}
