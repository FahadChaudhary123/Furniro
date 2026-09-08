import { defineConfig } from 'vitest/config';

/** Unit tests for the API's pure logic. The smoke suite covers the HTTP surface. */
export default defineConfig({
  test: {
    include: ['src/**/*.test.js'],
    environment: 'node',
    globals: false,
  },
});
