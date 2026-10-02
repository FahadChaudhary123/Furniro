/** Current API responses are small and may change with catalogue edits or deployment. */
export function cachePolicy(req, res, next) {
  if (req.path === '/health' || req.path.startsWith('/health/') ||
      req.path === '/api' || req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}
