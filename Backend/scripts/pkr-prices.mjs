#!/usr/bin/env node
/** Prepare or validate a complete PKR reprice without copying IDR amounts. */
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPkrCatalogue, pkrTemplate } from '../src/modules/catalogue/pricingMigration.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'src', 'modules', 'catalogue', 'data', 'products.json');
const [mode, input, extra] = process.argv.slice(2);
const usage = 'Usage: npm run prices:pkr -- --template [proposal.json] | --check <proposal.json> | --apply <proposal.json>';

try {
  if (extra || !['--template', '--check', '--apply'].includes(mode) ||
      (mode !== '--template' && !input)) {
    throw new Error(usage);
  }
  const catalogue = JSON.parse(readFileSync(DATA, 'utf8'));
  if (mode === '--template') {
    const blank = `${JSON.stringify(pkrTemplate(catalogue), null, 2)}\n`;
    if (input) {
      if (resolve(input) === resolve(DATA)) throw new Error('Template path must not be the catalogue');
      writeFileSync(resolve(input), blank, { encoding: 'utf8', flag: 'wx' });
      console.log('Blank PKR proposal written; catalogue unchanged.');
    } else {
      process.stdout.write(blank);
    }
  } else {
    if (resolve(input) === resolve(DATA)) throw new Error('Input must be a separate proposal file');
    const proposal = JSON.parse(readFileSync(resolve(input), 'utf8'));
    const next = buildPkrCatalogue(catalogue, proposal);
    if (mode === '--check') {
      console.log(`Valid PKR proposal for all ${next.products.length} products; catalogue unchanged.`);
    } else {
      const pending = `${DATA}.pending`;
      writeFileSync(pending, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      renameSync(pending, DATA);
      console.log(`Updated canonical catalogue: ${next.products.length} approved PKR prices.`);
    }
  }
} catch (error) {
  console.error(error.code === 'EEXIST' ? 'Proposal file already exists; choose a new path' : error.message);
  process.exitCode = 1;
}
