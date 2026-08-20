import { defineConfig, devices } from '@playwright/test'

const e2ePort = process.env.STUDY_E2E_PORT ?? '4187'
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  outputDir: '../artifacts/study-game/playwright-results',
  use: {
    baseURL: e2eBaseUrl,
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
    command: `npm run dev -- --port ${e2ePort}`,
    url: e2eBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
