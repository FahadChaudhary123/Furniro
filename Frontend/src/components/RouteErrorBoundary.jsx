import { Component } from 'react';

import { reportError } from '../shared/lib/reportError.js';

/**
 * Catches errors thrown while rendering a route, including a lazy chunk that fails to load.
 *
 * Without this, a rejected `import()` propagates past Suspense with nothing to catch it and
 * React unmounts the entire tree — navbar included — leaving a blank white page. That is not
 * a hypothetical: **after a deploy, a visitor still holding the previous HTML asks for a
 * chunk filename that no longer exists, gets a 404, and the site goes blank.** Flaky mobile
 * networks do the same thing intermittently.
 *
 * Must be a class: there is no hook equivalent of componentDidCatch.
 *
 * Reloading is the right remedy for a stale chunk specifically — it fetches fresh HTML with
 * the current filenames — so that is the primary action rather than a generic retry.
 */
class RouteErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // PLAT-04. Without this the only record of a render crash is a console line in a
    // browser nobody is looking at. `reportError` never throws — this is already the
    // failure path, and an exception here would replace a recoverable crash with a blank
    // page.
    reportError({
      kind: /Loading chunk|dynamically imported module/i.test(error?.message ?? '')
        ? 'chunk-load'
        : 'render',
      error,
      componentStack: info?.componentStack,
    });
    console.error('Route failed to render', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        role="alert"
        className="max-w-xl mx-auto px-4 py-24 text-center"
      >
        <h1 className="text-2xl font-semibold text-gray-900">This page could not be loaded</h1>
        <p className="mt-4 text-gray-600">
          Part of the site failed to download. This usually resolves on a reload — the site
          may have been updated since you opened it.
        </p>

        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="bg-[#B88E2F] text-white px-8 py-3 font-semibold hover:bg-[#a57f28] transition"
          >
            Reload the page
          </button>
          <a
            href="/"
            className="border border-[#B88E2F] text-[#B88E2F] px-8 py-3 font-semibold hover:bg-[#B88E2F] hover:text-white transition"
          >
            Go to the home page
          </a>
        </div>
      </div>
    );
  }
}

export default RouteErrorBoundary;
