#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platformMappingTemplate, validatePlatformMapping } from '../src/modules/catalogue/platformMapping.js';

const here = dirname(fileURLToPath(import.meta.url));
const data = join(here, '..', 'src', 'modules', 'catalogue', 'data', 'products.json');
const [mode, input, extra] = process.argv.slice(2);
const usage = 'Usage: npm run mapping -- --template [mapping.json] | --check <mapping.json>';

try {
  if (extra || !['--template', '--check'].includes(mode) || (mode === '--check' && !input)) {
    throw new Error(usage);
  }
  const catalogue = JSON.parse(readFileSync(data, 'utf8'));
  if (input && resolve(input) === resolve(data)) throw new Error('Mapping path must not be the catalogue');
  if (mode === '--template') {
    const template = `${JSON.stringify(platformMappingTemplate(catalogue), null, 2)}\n`;
    if (input) {
      writeFileSync(resolve(input), template, { encoding: 'utf8', flag: 'wx' });
      console.log('Blank mapping worksheet written; catalogue unchanged.');
    } else {
      process.stdout.write(template);
    }
  } else {
    const mapping = JSON.parse(readFileSync(resolve(input), 'utf8'));
    const count = validatePlatformMapping(catalogue, mapping);
    console.log(`Valid mapping for all ${count} products; platform IDs were not verified remotely.`);
  }
} catch (error) {
  console.error(error.code === 'EEXIST' ? 'Mapping file already exists; choose a new path' : error.message);
  process.exitCode = 1;
}
