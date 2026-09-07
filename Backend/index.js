/**
 * Entry point.
 *
 * The config module is imported first and loads dotenv at its own top level. ES module
 * imports are hoisted and evaluated before this file's body runs, so every module below
 * already sees a populated process.env.
 */

import { config, validateConfig, logger } from './src/platform/index.js';
import { createApp } from './src/app.js';

function start() {
  let warnings;
  try {
    warnings = validateConfig();
  } catch (err) {
    // Fail fast and loudly: a misconfigured server that starts is worse than one that does not.
    logger.error(`Configuration invalid: ${err.message}`);
    process.exit(1);
  }

  for (const warning of warnings) logger.warn(warning);

  const app = createApp();

  const server = app.listen(config.port, () => {
    logger.info('server listening', {
      port: config.port,
      env: config.env,
      build: config.build.sha,
      allowedOrigins: config.allowedOrigins,
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${config.port} is already in use. Set PORT in Backend/.env.`);
      process.exit(1);
    }
    logger.error(`Server error: ${err.message}`);
    process.exit(1);
  });

  /**
   * Graceful shutdown: stop accepting connections, let in-flight requests finish, then
   * exit. Without this a deploy can cut a request mid-response — and Doc B §3 expects every
   * release to be revertible cleanly.
   */
  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => {
      logger.info('server closed');
      process.exit(0);
    });
    // Do not hang forever on a stuck connection.
    setTimeout(() => {
      logger.error('forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled promise rejection', { reason: String(reason) });
  });
  process.on('uncaughtException', (err) => {
    logger.error('uncaught exception', { message: err.message, stack: err.stack });
    process.exit(1);
  });
}

start();
