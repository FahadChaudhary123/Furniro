/**
 * Generates `dist/sitemap.xml` and `dist/robots.txt` — `CONT-04`.
 *
 * Runs after `vite build`, writing into `dist/` rather than `public/`. That is deliberate:
 * a file in `public/` is source, gets stale the moment a product is added, and would sit in
 * the repository disagreeing with the catalogue. A generated artefact cannot drift.
 *
 * Dynamic URLs are expanded from the SAME files the API serves, not from a copy. If the
 * catalogue changes, the sitemap changes with it on the next build; there is no second list
 * of slugs to forget to update. See CLAUDE.md on product data living in exactly one place.
 *
 * Products blocked by the publish gate are excluded — the API returns 404 for them, and a
 * sitemap that advertises URLs the server will not serve is a crawl error per page.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateAll } from '../../Backend/src/modules/catalogue/publishGate.js';
import { listRedirects } from '../../Backend/src/modules/catalogue/redirects.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DIST = join(ROOT, 'dist');
const BACKEND = join(ROOT, '..', 'Backend', 'src', 'modules');

const ORIGIN = (process.env.VITE_SITE_ORIGIN ?? 'https://furniro.example.com').replace(/\/+$/, '');

if (!existsSync(DIST)) {
  console.error('dist/ does not exist — run `npm run build` first.');
  process.exit(1);
}

/**
 * Read the route manifest without importing it. The module uses `import.meta.env`, which
 * only exists inside Vite; parsing the paths out is less fragile than shimming a bundler
 * global just to read a list. `check-seo.mjs` verifies this stays in step.
 */
const manifest = readFileSync(join(ROOT, 'src', 'shared', 'lib', 'routes.js'), 'utf8');
const staticRoutes = [...manifest.matchAll(/\{\s*path:\s*'([^']+)'([\s\S]*?)\n {2}\}/g)]
  .map(([, path, body]) => ({
    path,
    priority: body.match(/priority:\s*([\d.]+)/)?.[1] ?? '0.5',
    changefreq: body.match(/changefreq:\s*'([^']+)'/)?.[1] ?? 'monthly',
    indexable: !/index:\s*false/.test(body),
  }))
  .filter((r) => r.indexable);

if (staticRoutes.length === 0) {
  console.error('Parsed no routes from the manifest — refusing to write an empty sitemap.');
  process.exit(1);
}

const catalogue = JSON.parse(
  readFileSync(join(BACKEND, 'catalogue', 'data', 'products.json'), 'utf8'),
);
const gateResult = evaluateAll(catalogue.products, {
  categoryNames: new Set(catalogue.categories),
});

/**
 * A discontinued product passes the publish gate — its data is fine, it is just not sold
 * any more — but the API answers 410 for it. Listing it in the sitemap would be a crawl
 * error per page, the same reason gate-blocked products are excluded.
 */
const gate = {
  ...gateResult,
  publishable: gateResult.publishable.filter((p) => p.discontinued !== true),
};
const discontinued = gateResult.publishable.length - gate.publishable.length;

const posts = JSON.parse(readFileSync(join(BACKEND, 'content', 'data', 'posts.json'), 'utf8'));
const postList = Array.isArray(posts) ? posts : (posts.posts ?? []);

const today = new Date().toISOString().slice(0, 10);

const urls = [
  ...staticRoutes.map((r) => ({ loc: r.path, changefreq: r.changefreq, priority: r.priority })),
  ...gate.publishable.map((p) => ({
    loc: `/shop/${p.slug}`,
    lastmod: p.created_at?.slice(0, 10),
    changefreq: 'weekly',
    priority: '0.8',
  })),
  // Placeholder posts are excluded: they exist so the blog renders, not because anyone
  // wrote them, and asking a crawler to index filler text earns a thin-content penalty.
  ...postList
    .filter((post) => !post._placeholder)
    .map((post) => ({
      loc: `/blog/${post.slug}`,
      lastmod: (post.published_at ?? post.created_at)?.slice(0, 10),
      changefreq: 'monthly',
      priority: '0.4',
    })),
];

const xmlEscape = (str) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((u) =>
    [
      '  <url>',
      `    <loc>${xmlEscape(ORIGIN + u.loc)}</loc>`,
      `    <lastmod>${u.lastmod ?? today}</lastmod>`,
      `    <changefreq>${u.changefreq}</changefreq>`,
      `    <priority>${u.priority}</priority>`,
      '  </url>',
    ].join('\n'),
  ),
  '</urlset>',
  '',
].join('\n');

const robots = `# Furniro — see docs/REQUIREMENTS.md CONT-04
User-agent: *
Allow: /

# Per-visitor pages with nothing to index. Crawling them spends budget on an empty cart.
Disallow: /cart

# Filtered listings are the same products in a different order. The canonical tag on /shop
# already collapses them; this stops the crawl before it starts.
Disallow: /shop?

Sitemap: ${ORIGIN}/sitemap.xml
`;

/**
 * CAT-08 — host configuration for real 301s.
 *
 * `_redirects` is the Netlify and Cloudflare Pages format: one rule per line, status last.
 * Written even when empty, so a deploy never silently leaves a previous build's stale rules
 * in place.
 *
 * The rules come from `redirects.js` — the same pure module the API's 410 answer resolves
 * through. A redirect map built from its own copy of the ranking would eventually disagree
 * with the API about where a discontinued product goes.
 *
 * That module is dependency-free on purpose. Importing the SERVICE instead reached
 * `repository.js` -> `logger.js` -> `config.js` -> `dotenv`, and the CI job that installs
 * only the front end's dependencies failed the build with ERR_MODULE_NOT_FOUND.
 *
 * Without this file deployed the SPA still redirects client-side. That is a fallback, not an
 * equivalent: it costs a round trip and search engines treat it less reliably than a 301.
 */
const redirects = listRedirects(catalogue.products, catalogue.categories);

const redirectsFile =
  ['# Generated by scripts/generate-seo.mjs — do not edit. CAT-08.', '# from  to  status']
    .concat(redirects.map((r) => `${r.from}  ${r.to}  301`))
    .join('\n') + '\n';

writeFileSync(join(DIST, '_redirects'), redirectsFile, 'utf8');
writeFileSync(join(DIST, 'sitemap.xml'), sitemap, 'utf8');
writeFileSync(join(DIST, 'robots.txt'), robots, 'utf8');

const blocked = gate.blocked.length;
console.log(
  `SEO artefacts written to dist/  —  sitemap.xml: ${urls.length} URLs ` +
    `(${staticRoutes.length} static, ${gate.publishable.length} products, ` +
    `${urls.length - staticRoutes.length - gate.publishable.length} posts)` +
    (blocked ? `, ${blocked} blocked by the publish gate` : '') +
    (discontinued ? `, ${discontinued} discontinued` : '') +
    `\n                              robots.txt: sitemap at ${ORIGIN}/sitemap.xml` +
    `\n                              _redirects: ${redirects.length} rule(s)`,
);
