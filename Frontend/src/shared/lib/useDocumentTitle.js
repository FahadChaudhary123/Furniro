import { useEffect } from 'react';

/**
 * Sets the document title for a route.
 *
 * An SPA renders one HTML file, so without this every page keeps whatever `index.html`
 * says — the tab, the bookmark and the browser history entry all read the same. That is a
 * usability problem and an SEO one (docs/REQUIREMENTS.md `CONT-04`).
 *
 * Restores the previous title on unmount so a transient page cannot leave its title behind.
 */

export const SITE_NAME = 'Furniro';

export function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
