import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  timeout: 20000,
  expect: { timeout: 5000 },
  use: {
    baseURL: 'http://127.0.0.1:8866',
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    viewport: { width: 844, height: 390 },
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && {
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          })
        }
      }
    },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ],
  webServer: {
    command: 'node tests/support/server.js',
    url: 'http://127.0.0.1:8866',
    reuseExistingServer: false
  }
});
