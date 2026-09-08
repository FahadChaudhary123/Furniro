/**
 * The route manifest — one definition of every static route the site has.
 *
 * `CONT-04` asks for SEO health: duplicate titles, orphaned pages, crawl coverage. None of
 * that can be checked while the answer to "what pages exist?" is spread across `App.jsx`,
 * the navbar, a sitemap and a build script. It is defined here once, and everything else
 * reads it:
 *
 *   - `scripts/generate-seo.mjs`  builds sitemap.xml and robots.txt from it
 *   - `scripts/check-seo.mjs`     audits it, and cross-checks it against App.jsx
 *   - `e2e/seo.spec.js`           visits every entry and asserts the rendered head
 *
 * Dynamic routes (`/shop/:slug`, `/blog/:slug`) are deliberately absent: their URLs come
 * from catalogue and content data, not from this file. The sitemap generator expands them.
 *
 * `description` is the meta description. Keep them under ~155 characters — beyond that
 * search results truncate, and a truncated description is a wasted one. `check-seo.mjs`
 * enforces it so the limit is not a comment nobody reads.
 */

export const SITE_NAME = 'Furniro';

/**
 * Production origin, used for canonical URLs and the sitemap.
 * Overridable so a staging deploy does not advertise production URLs as canonical —
 * that is how a staging site gets indexed in place of the real one.
 */
export const SITE_ORIGIN = (
  import.meta.env?.VITE_SITE_ORIGIN ?? 'https://furniro.example.com'
).replace(/\/+$/, '');

export const ROUTES = [
  {
    path: '/',
    title: null, // The home page is the bare site name, not "Home — Furniro".
    navLabel: 'Home',
    description:
      'Thoughtfully crafted furniture for dining, living and bedroom spaces. Browse the Furniro collection.',
    priority: 1.0,
    changefreq: 'weekly',
  },
  {
    path: '/shop',
    title: 'Shop',
    navLabel: 'Shop',
    description:
      'Browse every Furniro piece by category, price and style. Filter, sort and compare the full furniture range.',
    priority: 0.9,
    changefreq: 'daily',
  },
  {
    path: '/about',
    title: 'Blog',
    navLabel: 'About',
    description:
      'Guides, ideas and inspiration for furnishing your home, from the Furniro team.',
    priority: 0.6,
    changefreq: 'weekly',
  },
  {
    path: '/contact',
    title: 'Contact',
    navLabel: 'Contact',
    description:
      'Get in touch with Furniro. Find our address, phone number and working hours, or send us a message.',
    priority: 0.5,
    changefreq: 'monthly',
  },
  {
    path: '/cart',
    title: 'Cart',
    navLabel: null, // Reached by the header icon, not a nav link.
    description: 'Review the items in your Furniro cart before checking out.',
    // A cart is per-visitor and has nothing to index. Excluded from the sitemap and marked
    // noindex — a crawler following it wastes budget on a page that is empty for it.
    index: false,
  },
];

/** Routes that belong in the sitemap: everything indexable. */
export const indexableRoutes = () => ROUTES.filter((r) => r.index !== false);

/** Look a route up by path. Returns undefined for dynamic and unknown paths. */
export const routeFor = (path) => ROUTES.find((r) => r.path === path);
