import { defineConfig, devices } from '@playwright/test';

import { env } from './config/env.ts';

const full = env.evidence === 'full';
const crossBrowser = process.env.ALL_BROWSERS === 'true';
// Demo specs keep their data; they only run when explicitly enabled.
const demoIgnore = process.env.DEMO === 'true' ? [] : ['**/demo/**'];

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: env.isCI,
  retries: env.isCI ? 1 : 0,
  workers: env.workers,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: 'test-results',
  globalSetup: './config/global-setup.ts',
  globalTeardown: './config/global-teardown.ts',

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['junit', { outputFile: 'reports/junit/results.xml' }],
    ['json', { outputFile: 'reports/json/results.json' }],
    ['./reporting/ac-coverage-reporter.ts', { outputDir: 'reports/coverage' }],
  ],

  use: {
    baseURL: env.uiBaseUrl,
    locale: 'en-US',
    timezoneId: 'UTC',
    testIdAttribute: 'data-testid',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Evidence policy (see docs/evidence.md)
    screenshot: full ? 'on' : 'only-on-failure',
    video: full ? 'on' : 'retain-on-failure',
    trace: full ? 'on' : 'on-first-retry',
  },

  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      use: { baseURL: env.apiBaseUrl, screenshot: 'off', video: 'off', trace: full ? 'on' : 'off' },
    },
    {
      name: 'chromium',
      testIgnore: ['**/api/**', ...demoIgnore],
      use: { ...devices['Desktop Chrome'] },
    },
    // Optional cross-browser projects: enabled with ALL_BROWSERS=true (npm run test:all-browsers)
    ...(crossBrowser ? [
    {
      name: 'firefox',
      testIgnore: ['**/api/**', '**/codegen/**', '**/demo/**'],
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: ['**/api/**', '**/codegen/**', '**/demo/**'],
      use: { ...devices['Desktop Safari'] },
    },
    ] : []),
  ],
});
