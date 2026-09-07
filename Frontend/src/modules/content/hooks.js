/** Data-fetching hooks for content. Same shape as the catalogue module's. */

import { useState, useEffect, useCallback } from 'react';
import { fetchPosts, fetchRecentPosts, fetchTags, fetchPost } from './api.js';

function useAsync(run, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    run({ signal: controller.signal })
      .then((data) => live && setState({ data, loading: false, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError' || !live) return;
        setState({ data: null, loading: false, error });
      });

    return () => {
      live = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are declared by the caller
  }, [...deps, attempt]);

  return { ...state, retry };
}

export function usePosts({ page = 1, limit = 3, tag } = {}) {
  const { data, loading, error, retry } = useAsync(
    (opts) => fetchPosts({ page, limit, tag }, opts),
    [page, limit, tag],
  );
  return { posts: data?.data ?? [], meta: data?.meta ?? null, loading, error, retry };
}

export function useRecentPosts() {
  const { data, loading, error } = useAsync((opts) => fetchRecentPosts(opts), []);
  return { posts: data ?? [], loading, error };
}

export function useTags() {
  const { data, loading, error } = useAsync((opts) => fetchTags(opts), []);
  return { tags: data ?? [], loading, error };
}

/** One post. A 404 is a missing article, not a broken site. */
export function usePost(slug) {
  const { data, loading, error, retry } = useAsync((opts) => fetchPost(slug, opts), [slug]);
  return {
    post: data ?? null,
    notFound: error?.status === 404,
    loading,
    error: error?.status === 404 ? null : error,
    retry,
  };
}
