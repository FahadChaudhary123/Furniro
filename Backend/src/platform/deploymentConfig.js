/** Reject local or malformed browser origins before a production API starts. */
export function validateProductionOrigins(raw) {
  const origins = (raw ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!origins.length) throw new Error('ALLOWED_ORIGINS must be set in production');
  for (const origin of origins) {
    let url;
    try {
      url = new URL(origin);
    } catch {
      throw new Error('ALLOWED_ORIGINS must contain HTTPS origins');
    }
    if (url.protocol !== 'https:' || url.origin !== origin ||
        url.hostname === 'localhost' || url.hostname === '127.0.0.1' ||
        url.hostname === 'example.com' || url.hostname.endsWith('.example.com')) {
      throw new Error('ALLOWED_ORIGINS must contain HTTPS origins without paths or placeholders');
    }
  }
  if (new Set(origins).size !== origins.length) {
    throw new Error('ALLOWED_ORIGINS contains duplicate origins');
  }
  return origins;
}
