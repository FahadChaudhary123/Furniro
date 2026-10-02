#!/usr/bin/env node
import { checkDeployment } from '../src/platform/deploymentSmoke.js';

try {
  const result = await checkDeployment({
    apiOrigin: process.env.API_ORIGIN,
    storefrontOrigin: process.env.STOREFRONT_ORIGIN,
  });
  console.log(`Deployment smoke passed: build ${result.buildSha}, ${result.publishedProducts} published products.`);
} catch (error) {
  console.error(`Deployment smoke failed: ${error.message}`);
  process.exitCode = 1;
}
