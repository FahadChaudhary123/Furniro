/**
 * Graceful shutdown — stop accepting connections, let in-flight requests finish, exit.
 *
 * Doc B §3 expects every release to be revertible cleanly, and a deploy that cuts a request
 * mid-response is not that. In a container the orchestrator sends `SIGTERM` and waits; what
 * happens in that window is the difference between a clean rollout and a burst of 502s.
 *
 * Extracted from `index.js` so it can be tested. It previously lived inline, which meant the
 * only way to exercise it was to send a real signal — and on Windows `Stop-Process` is a hard
 * terminate that never runs a handler, so this path had only ever been read, not run. The
 * repository recorded it as "unverified" for exactly that reason.
 *
 * `exit` and `setTimeoutFn` are injectable purely so a test can observe them. Nothing in
 * production passes them.
 */

/**
 * @param {object} deps
 * @param {import('node:http').Server} deps.server
 * @param {{info: Function, warn: Function, error: Function}} deps.logger
 * @param {number} [deps.timeoutMs] how long to wait for in-flight requests
 * @param {Function} [deps.exit] process.exit, injectable for tests
 * @param {Function} [deps.setTimeoutFn] setTimeout, injectable for tests
 * @returns {(signal: string) => void}
 */
export function createShutdown({
  server,
  logger,
  timeoutMs = 10_000,
  exit = process.exit,
  setTimeoutFn = setTimeout,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
}) {
  let shuttingDown = false;

  return function shutdown(signal) {
    /**
     * A second signal means someone is impatient, or the orchestrator escalated. Re-entering
     * would call `server.close()` twice — the second call invokes its callback with an
     * `ERR_SERVER_NOT_RUNNING` error, so the process would log "server closed" for a close
     * that failed — and would start a second timer. Take the second signal as "stop waiting"
     * instead, which is what pressing Ctrl+C twice is meant to do.
     */
    if (shuttingDown) {
      logger.warn(`${signal} received again, exiting immediately`);
      exit(1);
      return;
    }
    shuttingDown = true;

    logger.info(`${signal} received, shutting down`);

    let clearSweep;

    server.close((err) => {
      clearSweep?.();
      if (err) {
        // The server was not running. Nothing to wait for, and nothing went wrong.
        logger.warn('server was not listening', { message: err.message });
        exit(0);
        return;
      }
      logger.info('server closed');
      exit(0);
    });

    /**
     * Keep-alive connections are swept until the server is closed — repeatedly, not once.
     *
     * `server.close()` waits for every open connection, and an HTTP/1.1 keep-alive socket
     * stays open after its response finishes. Calling `closeIdleConnections()` a single time
     * here only catches sockets that are *already* parked; a request still in flight at this
     * moment becomes idle a few milliseconds later and nothing closes it. `close()` then
     * never completes and the process exits 1 at the timeout — after every deploy that had
     * any traffic at all.
     *
     * A test caught this. The single call is the obvious implementation and it is wrong for
     * precisely the case that matters: shutting down a server that was being used.
     *
     * `unref` so the sweep never keeps the process alive on its own; cleared as soon as the
     * server reports closed.
     */
    const sweep = setIntervalFn(() => server.closeIdleConnections?.(), 50);
    sweep.unref?.();
    clearSweep = () => clearIntervalFn(sweep);
    server.closeIdleConnections?.();

    /**
     * The backstop. A request that never completes must not hold the process open forever —
     * the orchestrator will `SIGKILL` it anyway, and exiting on our own terms means the log
     * says why.
     *
     * `unref()` so this timer alone never keeps the process alive: if everything closed
     * cleanly the process should exit at once, not linger for the remainder of the window.
     */
    setTimeoutFn(() => {
      clearSweep?.();
      logger.error('forced shutdown after timeout', { timeoutMs });
      exit(1);
    }, timeoutMs).unref?.();
  };
}
