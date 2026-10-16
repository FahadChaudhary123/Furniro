import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', fullyParallel: true, forbidOnly: Boolean(process.env.CI),
  use: { baseURL: 'http://localhost:4174' },
  projects: [{ name: 'desktop', use: devices['Desktop Chrome'] }, { name: 'mobile', use: devices['Pixel 5'] }],
  webServer: { command: 'npm run build && npm run preview -- --strictPort', port: 4174, reuseExistingServer: false },
});
