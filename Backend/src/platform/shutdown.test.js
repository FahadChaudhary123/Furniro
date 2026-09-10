import { describe, it, expect, vi } from 'vitest';
import http from 'node:http';

import { createShutdown } from './shutdown.js';

/**
 * Graceful shutdown.
 *
 * The repository recorded this path as **unverified**: the handlers were written, but the
 * only way to exercise them was to send a real signal, and on Windows `Stop-Process` is a
 * hard terminate that never runs a handler. It had been read, never run.
 *
 * These run the logic directly against a real `http.Server`, which is what makes the claim
 * checkable on any platform. Signal *delivery* is still the operating system's business —
 * what is tested here is what happens once a signal arrives.
 */

const fakeLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

/** A listening server plus a helper to make a real request against it. */
async function listening() {
  let release;
  const server = http.createServer((req, res) => {
    if (req.url === '/slow') {
      // Held open until the test releases it — an in-flight request at shutdown time.
      release = () => res.end('done');
      return;
    }
    res.end('ok');
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();

  return {
    server,
    port,
    request: (path = '/') =>
      new Promise((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port, path }, (res) => {
          res.resume();
          res.on('end', () => resolve(res.statusCode));
        });
        req.on('error', reject);
      }),
    releaseSlow: () => release?.(),
  };
}

describe('a clean shutdown', () => {
  it('closes the server and exits 0', async () => {
    const { server } = await listening();
    const logger = fakeLogger();
    const exit = vi.fn();

    createShutdown({ server, logger, exit })('SIGTERM');
    await vi.waitFor(() => expect(exit).toHaveBeenCalled());

    expect(exit).toHaveBeenCalledWith(0);
    expect(logger.info).toHaveBeenCalledWith('SIGTERM received, shutting down');
    expect(logger.info).toHaveBeenCalledWith('server closed');
    expect(server.listening).toBe(false);
  });

  it('stops accepting new connections immediately', async () => {
    const { server, port } = await listening();
    createShutdown({ server, logger: fakeLogger(), exit: vi.fn() })('SIGTERM');

    // The socket is closed, so a new request must be refused rather than served.
    await expect(
      new Promise((resolve, reject) => {
        const req = http.get({ host: '127.0.0.1', port, path: '/' }, resolve);
        req.on('error', reject);
      }),
    ).rejects.toThrow();
  });

  it('names the signal it received, so the log says why the process went away', async () => {
    const { server } = await listening();
    const logger = fakeLogger();
    createShutdown({ server, logger, exit: vi.fn() })('SIGINT');
    expect(logger.info).toHaveBeenCalledWith('SIGINT received, shutting down');
  });
});

describe('in-flight requests', () => {
  it('waits for a request that is still being served', async () => {
    const { server, releaseSlow, request } = await listening();
    const exit = vi.fn();

    const inFlight = request('/slow');
    // Give the handler a moment to actually receive it.
    await vi.waitFor(() => expect(server.listening).toBe(true));
    await new Promise((r) => setTimeout(r, 50));

    createShutdown({ server, logger: fakeLogger(), exit })('SIGTERM');

    // The whole point: the process must not exit while a response is unfinished.
    await new Promise((r) => setTimeout(r, 150));
    expect(exit, 'exited while a request was still in flight').not.toHaveBeenCalled();

    releaseSlow();
    await inFlight;
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
  });

  it('does not wait for an idle keep-alive connection', async () => {
    // Measured rather than assumed: on this Node version an idle keep-alive socket does not
    // hold `server.close()` open, and `closeIdleConnections()` makes that explicit. If a
    // future Node reverts it, this fails rather than a deploy quietly taking 10 seconds.
    const { server, port } = await listening();
    const agent = new http.Agent({ keepAlive: true });
    const exit = vi.fn();

    await new Promise((resolve, reject) => {
      const req = http.get({ host: '127.0.0.1', port, path: '/', agent }, (res) => {
        res.resume();
        res.on('end', resolve);
      });
      req.on('error', reject);
    });

    createShutdown({ server, logger: fakeLogger(), exit })('SIGTERM');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0), { timeout: 2000 });

    agent.destroy();
  });
});

describe('the timeout backstop', () => {
  it('exits 1 when a request never finishes', async () => {
    const { server, request } = await listening();
    const logger = fakeLogger();
    const exit = vi.fn();
    let fire;
    const setTimeoutFn = vi.fn((fn) => {
      fire = fn;
      return { unref: () => {} };
    });

    request('/slow').catch(() => {}); // never released
    await new Promise((r) => setTimeout(r, 50));

    createShutdown({ server, logger, exit, timeoutMs: 10_000, setTimeoutFn })('SIGTERM');
    expect(setTimeoutFn).toHaveBeenCalledWith(expect.any(Function), 10_000);

    fire();
    expect(exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith('forced shutdown after timeout', {
      timeoutMs: 10_000,
    });

    server.closeAllConnections?.();
  });

  it('unrefs the timer so a clean shutdown is not delayed by it', async () => {
    // Without unref, a process that closed cleanly in 20ms would still be held for the
    // remainder of the window by the timer alone.
    const { server } = await listening();
    const unref = vi.fn();
    const setTimeoutFn = vi.fn(() => ({ unref }));

    createShutdown({ server, logger: fakeLogger(), exit: vi.fn(), setTimeoutFn })('SIGTERM');
    expect(unref).toHaveBeenCalled();
  });
});

describe('a second signal', () => {
  it('exits immediately rather than starting a second shutdown', async () => {
    const { server } = await listening();
    const logger = fakeLogger();
    const exit = vi.fn();

    const shutdown = createShutdown({ server, logger, exit });
    shutdown('SIGTERM');
    shutdown('SIGINT');

    expect(exit).toHaveBeenCalledWith(1);
    expect(logger.warn).toHaveBeenCalledWith('SIGINT received again, exiting immediately');
  });

  it('does not call server.close twice', async () => {
    // The second call invokes its callback with ERR_SERVER_NOT_RUNNING, which would have
    // logged "server closed" for a close that failed.
    const { server } = await listening();
    const close = vi.spyOn(server, 'close');

    const shutdown = createShutdown({ server, logger: fakeLogger(), exit: vi.fn() });
    shutdown('SIGTERM');
    shutdown('SIGTERM');

    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('when the server was never listening', () => {
  it('exits 0 rather than reporting a failure', async () => {
    const server = http.createServer();
    const logger = fakeLogger();
    const exit = vi.fn();

    createShutdown({ server, logger, exit })('SIGTERM');
    await vi.waitFor(() => expect(exit).toHaveBeenCalled());

    expect(exit).toHaveBeenCalledWith(0);
    expect(logger.info).not.toHaveBeenCalledWith('server closed');
  });
});
