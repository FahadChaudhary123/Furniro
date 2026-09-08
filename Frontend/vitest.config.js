import { defineConfig } from 'vitest/config';

/**
 * Unit tests for pure logic.
 *
 * Separate from `playwright.config.js` on purpose: these two answer different questions and
 * should be able to run independently. The end-to-end suite proves the app works in a
 * browser; these prove the arithmetic is right at its boundaries, which a browser test can
 * only reach indirectly and slowly.
 *
 * `e2e/` is excluded — Playwright's `test` and Vitest's `test` are different functions and
 * Vitest would happily try to run those files.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.js'],
    exclude: ['e2e/**', 'node_modules/**'],
    environment: 'node',
    // No jsdom: everything here is a pure function. A component test would need one, and
    // that is a decision to take when there is a component worth testing that way.
    globals: false,
    reporters: 'default',
  },
});
