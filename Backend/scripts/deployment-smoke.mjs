#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkDeployment } from '../src/platform/deploymentSmoke.js';
import { listRedirects } from '../src/modules/catalogue/redirects.js';

const here = dirname(fileURLToPath(import.meta.url));
const catalogue = JSON.parse(readFileSync(join(here, '../src/modules/catalogue/data/products.json'), 'utf8'));
const redirects = listRedirects(catalogue.products, catalogue.categories);

try {
  const result = await checkDeployment({
    apiOrigin: process.env.API_ORIGIN,
    storefrontOrigin: process.env.STOREFRONT_ORIGIN,
    redirects,
  });
  console.log(`Deployment smoke passed: build ${result.buildSha}, ${result.publishedProducts} published products, ${result.redirectsChecked} HTTP redirects.`);
} catch (error) {
  console.error(`Deployment smoke failed: ${error.message}`);
  process.exitCode = 1;
}
