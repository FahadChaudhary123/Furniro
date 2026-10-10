/**
 * Keep Render's HTTP 301 rules in step with the canonical catalogue (CAT-08).
 * Render ignores dist/_redirects, so a discontinued product must also have a Blueprint
 * redirect before the SPA catch-all rewrite. The actual HTTP response still needs a live
 * smoke check after deployment.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listRedirects } from '../../Backend/src/modules/catalogue/redirects.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Parse the deliberately simple routes section of this repository's render.yaml. */
export function renderRoutes(source) {
  const block = source.match(/^    routes:\s*\r?\n((?: {6}.*(?:\r?\n|$))*)/m)?.[1];
  if (!block) throw new Error('render.yaml has no static-site routes block');

  const rules = [...block.matchAll(
    /^      - type: (redirect|rewrite)\s*\r?\n        source: ([^\r\n]+)\r?\n        destination: ([^\r\n]+)/gm,
  )].map(([, type, from, to]) => ({ type, from: from.trim(), to: to.trim() }));

  if (rules.length === 0) throw new Error('render.yaml has no readable static-site routes');
  return rules;
}

export function checkRenderRedirects(products, categories, source) {
  const rules = renderRoutes(source);
  const rewrite = rules.findIndex((rule) => rule.type === 'rewrite' && rule.from === '/*');
  if (rewrite < 0 || rules[rewrite].to !== '/index.html') {
    throw new Error('Render SPA catch-all rewrite to /index.html is missing');
  }

  const errors = [];
  const expected = [...listRedirects(products, categories), { from: '/about', to: '/blog' }];
  for (const { from, to } of expected) {
    const match = rules.findIndex((rule) => rule.from === from);
    if (match < 0) errors.push(`${from} -> ${to}: missing Render 301`);
    else if (rules[match].type !== 'redirect' || rules[match].to !== to) {
      errors.push(`${from}: Render rule does not redirect to ${to}`);
    } else if (match >= rewrite) errors.push(`${from}: redirect must precede the SPA rewrite`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return expected.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const catalogue = JSON.parse(readFileSync(join(ROOT, 'Backend/src/modules/catalogue/data/products.json'), 'utf8'));
  const blueprint = readFileSync(join(ROOT, 'render.yaml'), 'utf8');
  try {
    const count = checkRenderRedirects(catalogue.products, catalogue.categories, blueprint);
    console.log(`Render redirects match required routes: ${count} HTTP 301 rule(s)`);
  } catch (error) {
    console.error(`Render redirect check failed:\n${error.message}`);
    process.exitCode = 1;
  }
}
