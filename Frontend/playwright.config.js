import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end verification.
 *
 * Starts both servers itself, so `npm run e2e` is the whole command — the front end needs
 * the API for the catalogue, and a suite that assumes someone remembered to start it is a
 * suite that fails for the wrong reason.
 *
 * Runs against the PRODUCTION build (`preview`), not the dev server: dev has HMR, different
 * asset handling and looser error surfacing. What ships is what should be tested.
 */

const API_PORT = 3100;
const WEB_PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],

  webServer: [
    {
      command: 'npm start',
      cwd: '../Backend',
      port: API_PORT,
      env: {
        PORT: String(API_PORT),
        ALLOWED_ORIGINS: `http://localhost:${WEB_PORT}`,
      },
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // Build then serve, so the suite exercises the real bundle.
      command: `npm run build && npm run preview -- --port ${WEB_PORT}`,
      port: WEB_PORT,
      env: { VITE_API_URL: `http://localhost:${API_PORT}/api` },
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
