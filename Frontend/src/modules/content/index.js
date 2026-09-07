/**
 * Content module — public interface.
 * Import only from here. See docs/MODULES.md#boundary-rules.
 */

export { usePosts, usePost, useRecentPosts, useTags } from './hooks.js';
export { ApiError } from './api.js';

/** Blog dates render as "14 Oct 2022" but are stored as real dates, so they sort. */
export const formatPostDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
