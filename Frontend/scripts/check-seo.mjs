/**
 * SEO health check — `CONT-04`.
 *
 * Doc B §15 names the failures to look for: duplicate titles, orphaned pages, crawl errors,
 * index coverage. Those are field measurements on a live site with real traffic, and none
 * of them exist yet. What can be checked before a deploy is the structural cause of each,
 * and that is what this does.
 *
 * Findings have two severities, matching the catalogue publish gate:
 *
 *   ERROR   the site is misconfigured in a way a crawler will act on. Exits non-zero.
 *   WARN    worth a human decision, not worth blocking a deploy on.
 *
 * Run after `npm run build`, since half the checks read `dist/`.
 *
 *   npm run seo              report; exit 1 on any error
 *   npm run seo -- --strict  exit 1 on warnings too
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DIST = join(ROOT, 'dist');
const strict = process.argv.includes('--strict');

const errors = [];
const warnings = [];
const err = (check, detail, why) => errors.push({ check, detail, why });
const warn = (check, detail, why) => warnings.push({ check, detail, why });

const read = (p) => readFileSync(p, 'utf8');

// --- the route manifest is the reference everything else is compared against --------------
const manifestSrc = read(join(ROOT, 'src', 'shared', 'lib', 'routes.js'));
const routes = [...manifestSrc.matchAll(/\{\s*path:\s*'([^']+)'([\s\S]*?)\n {2}\}/g)].map(
  ([, path, body]) => ({
    path,
    title: body.match(/title:\s*'([^']*)'/)?.[1] ?? (/title:\s*null/.test(body) ? null : undefined),
    navLabel:
      body.match(/navLabel:\s*'([^']*)'/)?.[1] ?? (/navLabel:\s*null/.test(body) ? null : undefined),
    description: body.match(/description:\s*\n?\s*'([^']*)'/)?.[1],
    indexable: !/index:\s*false/.test(body),
  }),
);

if (routes.length === 0) {
  err('manifest', 'no routes parsed', 'the rest of this report is meaningless');
}

// --- 1. duplicate titles -------------------------------------------------------------------
const byTitle = new Map();
for (const r of routes) {
  const key = r.title ?? '(site name)';
  byTitle.set(key, [...(byTitle.get(key) ?? []), r.path]);
}
for (const [title, paths] of byTitle) {
  if (paths.length > 1) {
    err(
      'duplicate title',
      `"${title}" on ${paths.join(', ')}`,
      'two pages competing for the same query; search engines pick one and drop the other',
    );
  }
}

// --- 2. descriptions present, and short enough to survive truncation ------------------------
const MAX_DESCRIPTION = 155;
for (const r of routes) {
  if (!r.description) {
    err('missing description', r.path, 'the search result shows a scraped fragment instead');
  } else if (r.description.length > MAX_DESCRIPTION) {
    warn(
      'long description',
      `${r.path} (${r.description.length} chars)`,
      `truncated at about ${MAX_DESCRIPTION}; the tail is wasted`,
    );
  }
}

// --- 3. the manifest and the router agree ---------------------------------------------------
const appSrc = read(join(ROOT, 'src', 'App.jsx'));
const routerPaths = [...appSrc.matchAll(/<Route\s+path="([^"]+)"/g)].map(([, p]) => p);
const dynamic = routerPaths.filter((p) => p.includes(':') || p === '*');
const staticRouterPaths = routerPaths.filter((p) => !p.includes(':') && p !== '*');

for (const p of staticRouterPaths) {
  if (!routes.some((r) => r.path === p)) {
    err(
      'orphaned page',
      p,
      'routed in App.jsx but absent from the manifest, so it is in no sitemap and has no meta',
    );
  }
}
for (const r of routes) {
  if (!staticRouterPaths.includes(r.path)) {
    err(
      'phantom route',
      r.path,
      'in the manifest but not routed; the sitemap would advertise a URL that 404s',
    );
  }
}

// --- 4. nav label, URL and page title describe the same thing --------------------------------
for (const r of routes) {
  if (r.title === undefined) continue;
  const title = (r.title ?? '').toLowerCase();
  const slug = r.path.replace(/^\//, '').toLowerCase();

  if (r.navLabel && title && r.navLabel.toLowerCase() !== title) {
    warn(
      'label/title mismatch',
      `${r.path}: nav says "${r.navLabel}", title says "${r.title}"`,
      'the link a visitor clicked and the page they landed on disagree',
    );
  }
  if (title && slug && slug !== title && !title.includes(slug) && !slug.includes(title)) {
    warn(
      'url/title mismatch',
      `${r.path} is titled "${r.title}"`,
      'the URL is what gets shared and indexed; it should describe the page',
    );
  }
}

// --- 5. build artefacts -----------------------------------------------------------------------
if (!existsSync(DIST)) {
  warn('no build', 'dist/ missing', 'run `npm run build` to check sitemap, robots and the head');
} else {
  for (const file of ['sitemap.xml', 'robots.txt']) {
    if (!existsSync(join(DIST, file))) {
      err('missing artefact', file, 'run `npm run seo:generate` after building');
    }
  }

  if (existsSync(join(DIST, 'sitemap.xml'))) {
    const sitemap = read(join(DIST, 'sitemap.xml'));
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, l]) => l);

    if (new Set(locs).size !== locs.length) {
      err(
        'duplicate sitemap entry',
        `${locs.length - new Set(locs).size} repeated`,
        'a URL listed twice signals inconsistent canonicalisation',
      );
    }
    for (const r of routes.filter((x) => x.indexable)) {
      if (!locs.some((l) => new URL(l).pathname === r.path)) {
        err('missing from sitemap', r.path, 'an indexable page a crawler has to find by luck');
      }
    }
    for (const r of routes.filter((x) => !x.indexable)) {
      if (locs.some((l) => new URL(l).pathname === r.path)) {
        err('noindex page in sitemap', r.path, 'the sitemap and the robots meta contradict');
      }
    }
    if (locs.some((l) => l.includes('localhost'))) {
      err(
        'localhost in sitemap',
        'VITE_SITE_ORIGIN unset at build',
        'a sitemap of localhost URLs is worse than no sitemap',
      );
    }
  }

  if (
    existsSync(join(DIST, 'robots.txt')) &&
    !read(join(DIST, 'robots.txt')).includes('Sitemap:')
  ) {
    err('robots.txt has no Sitemap line', 'robots.txt', 'crawlers look here first');
  }

  const html = read(join(DIST, 'index.html'));
  if (!/<html[^>]+lang=/.test(html)) {
    err('no lang attribute', 'index.html', 'screen readers and translation both need it');
  }
  if (!/<meta[^>]+name="viewport"/.test(html)) {
    err('no viewport meta', 'index.html', 'mobile ranking depends on it');
  }
}

// --- report ------------------------------------------------------------------------------------
const line = (f) => {
  console.log(`  ${f.check}: ${f.detail}`);
  console.log(`      ${f.why}`);
};

console.log('\nSEO health check  (CONT-04)');
console.log('='.repeat(66));
console.log(`  static routes       ${routes.length}`);
console.log(`  indexable           ${routes.filter((r) => r.indexable).length}`);
console.log(`  dynamic routes      ${dynamic.length} (${dynamic.join(', ')})`);
console.log(`  errors              ${errors.length}`);
console.log(`  warnings            ${warnings.length}`);

if (errors.length) {
  console.log('\nERRORS — a crawler will act on these');
  console.log('-'.repeat(66));
  errors.forEach(line);
}
if (warnings.length) {
  console.log('\nWARNINGS — a decision, not a blocker');
  console.log('-'.repeat(66));
  warnings.forEach(line);
}
if (!errors.length && !warnings.length) console.log('\nNo findings.');
console.log('');

process.exit(errors.length > 0 || (strict && warnings.length > 0) ? 1 : 0);
