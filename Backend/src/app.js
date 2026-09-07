/**
 * Composition root — mounts middleware and routers in order.
 *
 * Middleware order is load-bearing:
 *   1. correlation   first, so every later log line and error carries the id
 *   2. cors          before routes, so preflight is answered
 *   3. body parsers
 *   4. request log
 *   5. routers
 *   6. notFound      after every router, so it only fires when nothing matched
 *   7. errorHandler  LAST, and with four parameters
 */

import express from 'express';
import cors from 'cors';

import { productsRouter, categoriesRouter } from './modules/catalogue/index.js';
import { postsRouter } from './modules/content/index.js';
import {
  config,
  logger,
  correlationMiddleware,
  healthRouter,
  notFoundHandler,
  errorHandler,
} from './platform/index.js';

export function createApp() {
  const app = express();

  // Behind a proxy or load balancer, req.ip is the proxy without this.
  app.set('trust proxy', 1);
  // Do not advertise the framework.
  app.disable('x-powered-by');

  app.use(correlationMiddleware);

  /**
   * Explicit allowlist. `cors()` with no arguments reflects ANY origin — see
   * docs/API.md#cors. Requests with no Origin (curl, server-to-server, health probes) are
   * allowed through; the browser same-origin policy is what this header is protecting.
   */
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
        logger.warn('CORS origin rejected', { origin });
        return callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
    }),
  );

  // A body limit is a denial-of-service control, not a formality.
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  app.use((req, res, next) => {
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      // Method, path and status only — never the body, never the query string, which can
      // carry personal data. docs/SECURITY.md#handling-user-data.
      logger.info('request', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round(ms),
      });
    });
    next();
  });

  app.use(healthRouter);

  // Domain modules mount here as they are built — docs/MODULES.md#build-order.
  app.use('/api/products', productsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/posts', postsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
