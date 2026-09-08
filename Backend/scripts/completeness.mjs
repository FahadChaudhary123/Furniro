/**
 * Catalogue completeness report — `CAT-04`.
 *
 * Doc B §15 asks for a report of products failing the data-quality rules, resolved within
 * 14 days. This prints that report and exits non-zero when anything is blocked, so CI
 * enforces it continuously rather than leaving a 14-day window to remember.
 *
 * Reads the same rules the API enforces (`publishGate.js`) rather than restating them —
 * a report that can disagree with the gate is worse than no report.
 *
 *   npm run completeness            report, exit 1 if any product is blocked
 *   npm run completeness -- --json  machine-readable, for a dashboard
 *   npm run completeness -- --strict  also exit 1 on warnings
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateAll, ABSENT_FIELDS, RULE_COUNT } from '../src/modules/catalogue/publishGate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'src', 'modules', 'catalogue', 'data', 'products.json');

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const strict = args.has('--strict');

const raw = JSON.parse(readFileSync(DATA, 'utf8'));
const gate = evaluateAll(raw.products, { categoryNames: new Set(raw.categories) });

const total = raw.products.length;

/** Group failures by rule, so a systemic problem reads as one line rather than forty. */
const byRule = (entries, key) => {
  const map = new Map();
  for (const { report } of entries) {
    for (const failure of report[key]) {
      if (!map.has(failure.id)) map.set(failure.id, { ...failure, slugs: [] });
      map.get(failure.id).slugs.push(report.slug);
    }
  }
  return [...map.values()].sort((a, b) => b.slugs.length - a.slugs.length);
};

const blockingByRule = byRule(gate.blocked, 'blocking');
const warningByRule = byRule(gate.warned, 'warnings');

if (asJson) {
  console.log(
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        total,
        publishable: gate.publishable.length,
        blocked: gate.blocked.length,
        warned: gate.warned.length,
        rules_evaluated: RULE_COUNT,
        blocking: blockingByRule,
        warnings: warningByRule,
        absent_across_catalogue: ABSENT_FIELDS,
      },
      null,
      2,
    ),
  );
} else {
  const pct = ((gate.publishable.length / total) * 100).toFixed(1);
  console.log('\nCatalogue completeness report  (CAT-04)');
  console.log('='.repeat(62));
  console.log(`  products            ${total}`);
  console.log(`  publishable         ${gate.publishable.length}  (${pct}%)`);
  console.log(`  blocked             ${gate.blocked.length}`);
  console.log(`  with warnings       ${gate.warned.length}`);
  console.log(`  rules evaluated     ${RULE_COUNT} per product`);

  const section = (title, rules) => {
    if (rules.length === 0) return;
    console.log(`\n${title}`);
    console.log('-'.repeat(62));
    for (const rule of rules) {
      console.log(`  ${rule.id}  (${rule.slugs.length})  needs ${rule.describe}`);
      console.log(`      why: ${rule.why}`);
      const shown = rule.slugs.slice(0, 8).join(', ');
      const more = rule.slugs.length > 8 ? `, +${rule.slugs.length - 8} more` : '';
      console.log(`      ${shown}${more}`);
    }
  };

  section('BLOCKING — these products are not served', blockingByRule);
  section('WARNINGS — served, but incomplete', warningByRule);

  console.log('\nAbsent across the whole catalogue (CAT-01, not per-product failures)');
  console.log('-'.repeat(62));
  for (const field of ABSENT_FIELDS) console.log(`  ${field.id.padEnd(18)}${field.why}`);

  if (gate.blocked.length === 0 && gate.warned.length === 0) {
    console.log('\nEvery product passes every per-product rule.');
  }
  console.log('');
}

const failed = gate.blocked.length > 0 || (strict && gate.warned.length > 0);
process.exit(failed ? 1 : 0);
