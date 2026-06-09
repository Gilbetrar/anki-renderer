import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npx serve -l 3000 .',
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Local rendering service (on the Mac mini the deployed service already
      // listens on 9003, so an already-running instance is reused locally)
      command: 'server/.venv/bin/python -m uvicorn server.app:app --port 9003',
      url: 'http://localhost:9003/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
});
