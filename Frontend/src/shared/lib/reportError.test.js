import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { reportError, resetReportedErrors } from './reportError.js';

/**
 * The client error reporter — `PLAT-04`.
 *
 * This runs inside `componentDidCatch` and inside global error handlers: the places the app
 * is already broken. Its contract is mostly about what it must NOT do, and every one of
 * these is a way a reporter turns a recoverable crash into an outage.
 *
 * No jsdom: the module touches four globals and they are stubbed directly, which is smaller
 * and clearer than a simulated DOM for four properties.
 */

let sent;

beforeEach(() => {
  sent = [];
  resetReportedErrors();

  vi.stubGlobal('window', { location: { pathname: '/shop' } });
  vi.stubGlobal('navigator', {}); // no sendBeacon — exercises the fetch path
  vi.stubGlobal('Blob', class {});
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) => {
      sent.push({ url, body: JSON.parse(options.body) });
      return Promise.resolve({ ok: true });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('what it sends', () => {
  it('posts the message, kind and path', () => {
    reportError({ kind: 'render', error: new Error('boom') });

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toMatch(/\/client-errors$/);
    expect(sent[0].body).toMatchObject({ kind: 'render', message: 'boom', path: '/shop' });
    expect(sent[0].body.stack).toBeTruthy();
  });

  it('sends the path without its query string', () => {
    // `/shop?q=<search term>` is the visitor's search. It is not needed to fix a bug and it
    // is not ours to log.
    vi.stubGlobal('window', { location: { pathname: '/shop', search: '?q=sofa' } });
    reportError({ kind: 'render', error: new Error('boom') });
    expect(sent[0].body.path).toBe('/shop');
    expect(JSON.stringify(sent[0].body)).not.toContain('sofa');
  });

  it('uses fetch with keepalive so a report survives the page closing', () => {
    // A fatal error is usually followed by the visitor leaving. Without keepalive the
    // request is cancelled on unload and the crash is never recorded.
    reportError({ kind: 'render', error: new Error('boom') });
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'POST', keepalive: true });
  });

  it('prefers sendBeacon when the browser has it', () => {
    const beacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    reportError({ kind: 'render', error: new Error('boom') });

    expect(beacon).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('falls back to fetch when sendBeacon refuses the payload', () => {
    // sendBeacon returns false when the queue is full or the payload is too large.
    // Treating that as sent would silently drop the report.
    vi.stubGlobal('navigator', { sendBeacon: vi.fn(() => false) });
    reportError({ kind: 'render', error: new Error('boom') });
    expect(fetch).toHaveBeenCalledOnce();
  });
});

describe('a thrown value is not always an Error', () => {
  it('handles a thrown string', () => {
    reportError({ kind: 'window-error', error: 'plain string failure' });
    expect(sent[0].body.message).toBe('plain string failure');
  });

  it('handles a thrown object with no message', () => {
    reportError({ kind: 'window-error', error: { code: 42 } });
    expect(sent[0].body.message).toBeTruthy();
    expect(sent[0].body.message).not.toBe('undefined');
  });

  it('handles null and undefined', () => {
    reportError({ kind: 'window-error', error: null });
    reportError({ kind: 'unhandled-rejection', error: undefined });
    expect(sent).toHaveLength(2);
    for (const { body } of sent) expect(body.message).toBeTruthy();
  });

  it('omits the stack when there is no Error to take one from', () => {
    reportError({ kind: 'window-error', error: 'no stack here' });
    expect(sent[0].body.stack).toBeUndefined();
  });
});

describe('it must not flood', () => {
  it('sends the same error only once per page load', () => {
    // A render loop throws the same error every frame. Without this, one bug becomes
    // thousands of requests from every affected visitor at once.
    for (let i = 0; i < 50; i += 1) reportError({ kind: 'render', error: new Error('same') });
    expect(sent).toHaveLength(1);
  });

  it('treats the same message under a different kind as distinct', () => {
    reportError({ kind: 'render', error: new Error('same') });
    reportError({ kind: 'window-error', error: new Error('same') });
    expect(sent).toHaveLength(2);
  });

  it('stops after a bounded number of distinct errors', () => {
    for (let i = 0; i < 100; i += 1) reportError({ kind: 'render', error: new Error(`e${i}`) });
    expect(sent.length).toBeLessThanOrEqual(10);
  });
});

describe('it must never throw', () => {
  it('survives a transport that throws synchronously', () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('network stack is broken');
    });
    expect(() => reportError({ kind: 'render', error: new Error('boom') })).not.toThrow();
  });

  it('survives a rejected request without an unhandled rejection', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    expect(() => reportError({ kind: 'render', error: new Error('boom') })).not.toThrow();
  });

  it('survives window being unavailable', () => {
    vi.stubGlobal('window', undefined);
    expect(() => reportError({ kind: 'render', error: new Error('boom') })).not.toThrow();
  });

  it('survives being called with no arguments at all', () => {
    expect(() => reportError()).not.toThrow();
  });

  it('does not report a failure that happened inside itself', () => {
    // The loop that matters: if reporting an error itself errors, reporting that would
    // error again. One bug would become an infinite request loop from every visitor.
    let depth = 0;
    vi.stubGlobal('fetch', () => {
      depth += 1;
      reportError({ kind: 'render', error: new Error('inner') });
      throw new Error('transport failed');
    });

    reportError({ kind: 'render', error: new Error('outer') });
    expect(depth).toBe(1);
  });
});
