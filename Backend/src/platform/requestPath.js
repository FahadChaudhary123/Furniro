/** Operator paths contain order IDs. Keep them out of routine request/error logs. */
export function requestLogPath(req) {
  const path = req.originalUrl?.split('?')[0] ?? req.path;
  return path === '/api/operator' || path?.startsWith('/api/operator/') ? '/api/operator' : req.path;
}
