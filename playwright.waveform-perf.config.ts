import { defineConfig } from '@playwright/test';

const isWindows = process.platform === 'win32';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/waveform.perf.spec.ts'],
  timeout: isWindows ? 120000 : 60000,
  retries: isWindows || process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: 'line',
  use: {
    trace: 'on-first-retry',
  },
});
