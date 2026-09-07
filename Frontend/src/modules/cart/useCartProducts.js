import { useEffect, useState } from 'react';
import { fetchProducts } from '../catalogue/api.js';

/**
 * Hydrates cart lines with their current product detail.
 *
 * The cart stores only `{ slug, quantity }`, so prices always come from the server and a
 * repricing is reflected immediately. One batched request (`?slugs=`) rather than one per
 * line.
 *
 * `hydrating` is DERIVED, not stored: it is simply "the slugs I was asked for are not the
 * slugs I have settled". That removes the synchronous `setState` a loading flag would
 * otherwise need inside the effect — which React 19's `set-state-in-effect` rule objects to,
 * because it costs an extra render pass on every dependency change. State that can be
 * computed should not be stored.
 *
 * @param {string} slugKey - comma-separated, sorted slugs; '' when the cart is empty
 */
export function useCartProducts(slugKey) {
  const [settled, setSettled] = useState({ key: '', products: [], error: null });

  useEffect(() => {
    if (!slugKey) return;

    const controller = new AbortController();
    let live = true;

    fetchProducts({ slugs: slugKey, limit: 100 }, { signal: controller.signal })
      .then((res) => {
        if (live) setSettled({ key: slugKey, products: res.data, error: null });
      })
      .catch((err) => {
        // An abort is this effect being superseded, not a failure to report.
        if (err.name === 'AbortError' || !live) return;
        setSettled({ key: slugKey, products: [], error: err });
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [slugKey]);

  return {
    products: settled.products,
    error: settled.error,
    hydrating: Boolean(slugKey) && settled.key !== slugKey,
  };
}
