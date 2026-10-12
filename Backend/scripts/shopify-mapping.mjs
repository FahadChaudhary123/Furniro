#!/usr/bin/env node
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { checkShopifyMapping } from '../src/modules/catalogue/shopifyMapping.js';

const [input, extra] = process.argv.slice(2);
if (!input || extra) {
  console.error('Usage: npm run mapping:shopify -- <mapping.json>');
  process.exitCode = 1;
} else {
  let catalogue;
  let mapping;
  try {
    catalogue = JSON.parse(readFileSync(new URL('../src/modules/catalogue/data/products.json', import.meta.url), 'utf8'));
    mapping = JSON.parse(readFileSync(input, 'utf8'));
  } catch {
    console.error('Cannot read catalogue or mapping JSON; check file paths and syntax');
    process.exitCode = 1;
  }
  if (!process.exitCode) {
    try {
      const { checked, issues } = await checkShopifyMapping(catalogue, mapping, {
        domain: process.env.SHOPIFY_STORE_DOMAIN,
        token: process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN,
      });
      for (const issue of issues) console.error(`${issue.slug}: ${issue.reason}`);
      console.log(`${checked} variants checked; ${issues.length} issue(s). No store data changed.`);
      console.log('This is not checkout approval; verify images, stock/lead times, tax, shipping and payment separately.');
      if (issues.length) process.exitCode = 1;
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
