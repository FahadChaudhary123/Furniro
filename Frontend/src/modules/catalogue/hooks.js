/**
 * Data-fetching hooks for the catalogue.
 *
 * Deliberately small and dependency-free. A server-state library (React Query and the like)
 * earns its place once there is caching, revalidation and mutation to coordinate — see
 * docs/ARCHITECTURE.md#state. There is none of that yet, and adding one now would be a
 * dependency carried for a feature that does not exist.
 *
 * Every request is abortable, so a fast filter change cannot land a stale response over a
 * newer one.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchProducts, fetchFeaturedProducts, fetchCategories, fetchProduct } from './api.js';

/**
 * Shared fetch lifecycle.
 * @param {(opts: {signal: AbortSignal}) => Promise<any>} run
 * @param {any[]} deps
 */
function useAsync(run, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    run({ signal: controller.signal })
      .then((data) => {
        if (live) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        // An abort is this effect being superseded, not a failure to report.
        if (error.name === 'AbortError' || !live) return;
        setState({ data: null, loading: false, error });
      });

    return () => {
      live = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `run` is recreated per render by design; deps are declared by the caller
  }, [...deps, attempt]);

  return { ...state, retry };
}

/**
 * Paginated catalogue. Filtering, sorting and paging happen on the server — the client
 * holding all 40 rows and sorting locally would stop working the moment the catalogue
 * outgrows one page.
 */
export function useProducts({ page = 1, limit = 16, sort, category, q } = {}) {
  const params = useMemo(
    () => ({ page, limit, sort, category, q }),
    [page, limit, sort, category, q],
  );

  const { data, loading, error, retry } = useAsync(
    (opts) => fetchProducts(params, opts),
    [page, limit, sort, category, q],
  );

  return {
    products: data?.data ?? [],
    meta: data?.meta ?? null,
    loading,
    error,
    retry,
  };
}

export function useFeaturedProducts() {
  const { data, loading, error, retry } = useAsync((opts) => fetchFeaturedProducts(opts), []);
  return { products: data ?? [], loading, error, retry };
}

/**
 * One product by slug. A 404 is a distinct outcome from a failure — an unknown slug is a
 * missing page, not a broken site, and the two deserve different UI.
 */
export function useProduct(slug) {
  const { data, loading, error, retry } = useAsync((opts) => fetchProduct(slug, opts), [slug]);
  return {
    product: data ?? null,
    notFound: error?.status === 404,
    loading,
    error: error?.status === 404 ? null : error,
    retry,
  };
}

export function useCategories() {
  const { data, loading, error, retry } = useAsync((opts) => fetchCategories(opts), []);
  return { categories: data ?? [], loading, error, retry };
}
