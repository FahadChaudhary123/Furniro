import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

function urlFor(raw, name) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} must be an absolute HTTPS URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      url.hostname === 'localhost' || url.hostname === '127.0.0.1' ||
      url.hostname === 'example.com' || url.hostname.endsWith('.example.com')) {
    throw new Error(`${name} must be a public HTTPS URL without credentials or placeholders`);
  }
  return url;
}

/** Validate the public values that Vite will bake into the Render storefront bundle. */
export function validateDeployConfig({ VITE_API_URL, VITE_SITE_ORIGIN }) {
  const api = urlFor(VITE_API_URL, 'VITE_API_URL');
  const site = urlFor(VITE_SITE_ORIGIN, 'VITE_SITE_ORIGIN');
  if (api.pathname !== '/api' || api.href !== `${api.origin}/api`) {
    throw new Error('VITE_API_URL must end in /api with no trailing slash');
  }
  if (VITE_SITE_ORIGIN !== site.origin) {
    throw new Error('VITE_SITE_ORIGIN must be an origin without a path or trailing slash');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    validateDeployConfig(process.env);
    console.log('Public deployment URLs are valid.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
