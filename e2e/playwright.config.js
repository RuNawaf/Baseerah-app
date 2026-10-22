import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4100;
const CLIENT_PORT = 5174;
const FIXTURE_PORT = 4400;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  outputDir: '../test-results',
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { executablePath } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { executablePath } }, grep: /@mobile/ },
  ],
  webServer: [
    {
      command: 'node server/test/fixtures/serve.js',
      cwd: '..',
      url: `http://127.0.0.1:${FIXTURE_PORT}/`,
      env: { FIXTURE_PORT: String(FIXTURE_PORT), FIXTURE_EXTERNAL_PORT: String(FIXTURE_PORT + 1) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node server/src/index.js',
      cwd: '..',
      url: `http://localhost:${API_PORT}/api/health`,
      env: {
        PORT: String(API_PORT),
        NODE_ENV: 'test',
        LOG_LEVEL: 'warn',
        // The fixture site runs on localhost, which SSRF protection blocks in normal use.
        ALLOW_PRIVATE_NETWORK_TARGETS: 'true',
        RATE_LIMIT_PER_MINUTE: '1000',
        PLAYWRIGHT_CHROMIUM_EXECUTABLE: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? '',
      },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev -w client',
      cwd: '..',
      url: `http://localhost:${CLIENT_PORT}/`,
      env: { CLIENT_PORT: String(CLIENT_PORT), API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      reuseExistingServer: !process.env.CI,
    },
  ],
});

export const FIXTURE_URL = `http://127.0.0.1:${FIXTURE_PORT}/`;