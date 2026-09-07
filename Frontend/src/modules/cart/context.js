import { createContext } from 'react';

/**
 * The cart context object, alone in its own file.
 *
 * Fast Refresh only works when a module exports components and nothing else, so the
 * context, the provider and the hook each live separately.
 */
export const CartContext = createContext(null);
