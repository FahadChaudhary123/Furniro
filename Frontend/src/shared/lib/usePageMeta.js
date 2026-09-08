import { useEffect } from 'react';

import { SITE_NAME, SITE_ORIGIN, routeFor } from './routes.js';

/**
 * Sets the head tags a crawler actually reads: title, meta description, canonical, robots.
 *
 * `CONT-04`. An SPA serves one `index.html`, so without this every route shares the head
 * written at build time — one title, one description, one canonical URL pointing at the
 * home page. To a search engine that is a site with a single page and a lot of duplicate
 * content, which is the "duplicate titles" failure the requirement names.
 *
 * Written by hand rather than with a helmet library: this is about forty lines, runs on
 * every route, and the alternative is a dependency plus a provider in the tree. See
 * CLAUDE.md on measuring before adding one.
 *
 * Every tag is restored on unmount, so a route that sets `noindex` cannot leave the whole
 * site marked `noindex` after the visitor navigates away — a real and very expensive bug.
 */

/** Create-or-update a `<meta>` by name, returning how to put it back. */
function setMeta(name, content) {
  const existing = document.head.querySelector(`meta[name="${name}"]`);

  if (!content) {
    // Nothing to set. Remove an inherited tag so the previous route's value does not leak.
    if (!existing) return () => {};
    const previous = existing.getAttribute('content');
    existing.remove();
    return () => {
      const restored = document.createElement('meta');
      restored.setAttribute('name', name);
      restored.setAttribute('content', previous);
      document.head.appendChild(restored);
    };
  }

  if (existing) {
    const previous = existing.getAttribute('content');
    existing.setAttribute('content', content);
    return () => existing.setAttribute('content', previous);
  }

  const created = document.createElement('meta');
  created.setAttribute('name', name);
  created.setAttribute('content', content);
  document.head.appendChild(created);
  return () => created.remove();
}

/** Create-or-update `<link rel="canonical">`, returning how to put it back. */
function setCanonical(href) {
  const existing = document.head.querySelector('link[rel="canonical"]');
  if (!href) return () => {};

  if (existing) {
    const previous = existing.getAttribute('href');
    existing.setAttribute('href', previous === href ? previous : href);
    return () => existing.setAttribute('href', previous);
  }

  const created = document.createElement('link');
  created.setAttribute('rel', 'canonical');
  created.setAttribute('href', href);
  document.head.appendChild(created);
  return () => created.remove();
}

/**
 * Accepts either a static route path — looked up in the manifest, so the page and the
 * sitemap cannot disagree — or an explicit object for a data-driven page whose title comes
 * from a product or a post.
 *
 *   usePageMeta('/shop')
 *   usePageMeta({ title: product.name, description: product.description })
 *
 * @param {string|object} input
 * @param {string|null} [input.title]       page title, or null for the bare site name
 * @param {string} [input.description]      meta description
 * @param {string} [input.path]             path for the canonical URL; defaults to the
 *                                          current location, minus query and hash
 * @param {boolean} [input.index]           false to emit `noindex, follow`
 */
export function usePageMeta(input = {}) {
  const resolved = typeof input === 'string' ? (routeFor(input) ?? { path: input }) : input;
  const { title, description, path, index = true } = resolved;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} — ${SITE_NAME}` : SITE_NAME;

    // Query and hash are stripped deliberately. `/shop?category=dining&page=2` and
    // `/shop?page=2&category=dining` are the same page to a customer and two pages to a
    // crawler; a canonical without parameters collapses them back into one.
    const canonicalPath = path ?? window.location.pathname;
    const restore = [
      setMeta('description', description),
      setCanonical(`${SITE_ORIGIN}${canonicalPath}`),
      setMeta('robots', index ? null : 'noindex, follow'),
    ];

    return () => {
      document.title = previousTitle;
      // Reverse order: the last change made is the first undone, so overlapping updates
      // during a route transition unwind to the state they started from.
      for (const undo of restore.reverse()) undo();
    };
  }, [title, description, path, index]);
}
