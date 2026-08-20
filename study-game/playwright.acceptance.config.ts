import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['line'],
    ['json', { outputFile: '../artifacts/study-game/playwright-acceptance-r2-final-results.json' }],
  ],
  outputDir: '../artifacts/study-game/playwright-acceptance-r2-final',
  use: {
    baseURL: 'http://127.0.0.1:4197',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'on',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 4197',
    url: 'http://127.0.0.1:4197',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
