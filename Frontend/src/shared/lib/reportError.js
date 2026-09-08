/**
 * Client error reporting — `PLAT-04`.
 *
 * A crash in a visitor's browser is invisible to the server: the API answered 200, the
 * bundle threw afterwards, and nothing anywhere knows. The blank `/shop` page that prompted
 * the end-to-end suite was exactly this, and it was found by a person opening the page.
 *
 * This posts what broke to `POST /api/client-errors`, which logs it beside every other
 * structured log line. Rules it has to obey, because a reporter that misbehaves is worse
 * than no reporter:
 *
 *   1. **It must never throw.** It runs inside `componentDidCatch` and inside global error
 *      handlers — the places the app is already broken. An exception here replaces a
 *      recoverable crash with an unrecoverable one.
 *   2. **It must never loop.** If reporting fails, that failure must not be reported. A
 *      recursive reporter turns one error into a request flood.
 *   3. **It must not block.** Fire and forget; nothing waits on the response.
 *   4. **It must not carry personal data.** The path is sent without its query string —
 *      `/shop?q=<search term>` is the visitor's search, and it is not needed to fix a bug.
 */

const ENDPOINT = '/client-errors';
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

/** Reports already sent this page load, so a render loop cannot send thousands. */
const seen = new Set();
const MAX_DISTINCT = 10;

/** Set while a report is in flight, so a failure inside the reporter is never reported. */
let reporting = false;

/** The current path with the query string removed. */
function safePath() {
  try {
    return window.location.pathname;
  } catch {
    return null;
  }
}

/**
 * Send one report. Returns nothing and never rejects.
 *
 * @param {object} report
 * @param {string} report.kind  render | unhandled-rejection | window-error | chunk-load
 * @param {unknown} report.error  the thrown value — not necessarily an Error
 * @param {string} [report.componentStack]  React's component stack, when there is one
 */
export function reportError({ kind, error, componentStack } = {}) {
  try {
    if (reporting) return;

    // A thrown value is not always an Error. `throw 'oops'` and `throw {code: 1}` are both
    // legal, and `error.message` on either is undefined — which the server drops.
    const message =
      (error instanceof Error ? error.message : null) ??
      (typeof error === 'string' ? error : null) ??
      String(error ?? 'Unknown error');

    const fingerprint = `${kind}:${message}`;
    if (seen.has(fingerprint)) return;
    if (seen.size >= MAX_DISTINCT) return;
    seen.add(fingerprint);

    const body = JSON.stringify({
      kind,
      message,
      path: safePath(),
      stack: error instanceof Error ? error.stack : undefined,
      componentStack,
      release: import.meta.env.VITE_GIT_SHA,
    });

    const url = `${BASE}${ENDPOINT}`;
    reporting = true;

    /**
     * `sendBeacon` first: it survives the page being closed, which is exactly when a fatal
     * error tends to be followed by the visitor leaving. It cannot set a content type of
     * application/json without a Blob, hence the wrapper.
     */
    const sent =
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));

    if (!sent) {
      // `keepalive` gives fetch the same survive-unload property, with a smaller size cap.
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        // The report is not worth a CORS preflight failure taking down the page.
      }).catch(() => {});
    }
  } catch {
    // Swallowed deliberately. See rule 1: this runs where the app is already broken.
  } finally {
    reporting = false;
  }
}

/**
 * Attach global handlers for errors React never sees: an exception in an event handler, a
 * rejected promise nobody caught, a script that failed to parse.
 *
 * Returns a teardown function. Safe to call more than once — the second call replaces the
 * first rather than stacking listeners.
 */
let detach = null;

export function installErrorReporting() {
  if (detach) detach();

  const onError = (event) => {
    reportError({
      kind: /Loading chunk|dynamically imported module/i.test(event?.message ?? '')
        ? 'chunk-load'
        : 'window-error',
      error: event?.error ?? event?.message,
    });
  };

  const onRejection = (event) => {
    reportError({ kind: 'unhandled-rejection', error: event?.reason });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  detach = () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    detach = null;
  };

  return detach;
}

/** Test seam: forget what has already been reported. */
export const resetReportedErrors = () => seen.clear();
