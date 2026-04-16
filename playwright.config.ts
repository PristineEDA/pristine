import { defineConfig } from '@playwright/test';

const isWindows = process.platform === 'win32';

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/*.perf.spec.ts'],
  timeout: isWindows ? 120000 : 30000,
  retries: isWindows || process.env['CI'] ? 1 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI']
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : 'list',
  use: {
    trace: 'on-first-retry',
  },
});
