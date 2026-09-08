/**
 * HTTP client for the content API. Mirrors the catalogue client's contract so both
 * modules fail and report the same way.
 */

import { resolveImage } from './images.js';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(message, { status, code, correlationId } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
  }
}

async function request(path, { signal } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, { signal, headers: { Accept: 'application/json' } });
  } catch (cause) {
    if (cause.name === 'AbortError') throw cause;
    throw new ApiError('Could not reach the server. Is the API running?', { status: 0 });
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    /* empty or non-JSON body handled below */
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

/** `image` becomes `{src, webp}` so components can render a <picture>. */
const hydrate = (post) => ({ ...post, image: resolveImage(post.image) });

export async function fetchPosts(params = {}, options = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  );
  const body = await request(`/posts?${query}`, options);
  return { ...body, data: body.data.map(hydrate) };
}

export async function fetchRecentPosts(options = {}) {
  return (await request('/posts/recent', options)).data.map(hydrate);
}

export async function fetchTags(options = {}) {
  return (await request('/posts/tags', options)).data;
}

export async function fetchPost(slug, options = {}) {
  return hydrate(await request(`/posts/${encodeURIComponent(slug)}`, options));
}
