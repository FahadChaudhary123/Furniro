/**
 * HTTP client for the catalogue API.
 *
 * The base URL comes from `VITE_API_URL`. Vite inlines every VITE_-prefixed variable into
 * the public bundle as a string literal, so this — and anything else with that prefix — is
 * public. Never put a secret behind it. See docs/SECURITY.md#the-vite-rule.
 *
 * Image keys are resolved here, at the boundary, so no component ever sees a raw key.
 */

import { resolveImage } from './images.js';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

/** The API's documented error shape (docs/API.md#error-shape), as an Error. */
export class ApiError extends Error {
  constructor(message, { status, code, correlationId } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    // Worth surfacing in a bug report: it ties the failure to a server-side log line.
    this.correlationId = correlationId;
  }
}

async function request(path, { signal } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch (cause) {
    // fetch rejects only on network failure — a 500 resolves normally.
    if (cause.name === 'AbortError') throw cause;
    throw new ApiError('Could not reach the server. Is the API running?', { status: 0 });
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // fall through; an empty or non-JSON body is handled below
  }

  if (!response.ok) {
    throw new ApiError(body?.error?.message ?? `Request failed (${response.status})`, {
      status: response.status,
      code: body?.error?.code,
      correlationId: body?.error?.correlationId,
    });
  }

  return body;
}

/** Turn API rows into render-ready ones. Only the image needs it; prices stay integers. */
const hydrate = (product) => ({ ...product, image: resolveImage(product.image) });

/**
 * @param {object} params - page, limit, category, sort, q, min_price, max_price
 * @returns {Promise<{data: object[], meta: object}>}
 */
export async function fetchProducts(params = {}, options = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  );
  const body = await request(`/products?${query}`, options);
  return { ...body, data: body.data.map(hydrate) };
}

export async function fetchFeaturedProducts(options = {}) {
  const body = await request('/products/featured', options);
  return body.data.map(hydrate);
}

export async function fetchProduct(slug, options = {}) {
  return hydrate(await request(`/products/${encodeURIComponent(slug)}`, options));
}

export async function fetchCategories(options = {}) {
  const body = await request('/categories', options);
  return body.data;
}
