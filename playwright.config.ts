import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the production build, served the way GitHub Pages serves it.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/z-composer/',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: 'chromium', testIgnore: '**/embed.e2e.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // The built package embedded in a host page (e2e/host), as the integration guide does it.
    { name: 'embed', testMatch: '**/embed.e2e.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, baseURL: 'http://localhost:4174/' } },
  ],
  webServer: [
    {
      command: 'npx vite build && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173/z-composer/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run build:lib && npx vite --config e2e/host/vite.config.ts',
      url: 'http://localhost:4174/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
