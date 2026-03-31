import { defineConfig } from 'vitest/config'
import path from 'path'

const isCoverageRun = process.argv.some((arg) => arg === '--coverage' || arg.startsWith('--coverage.'))
const isWindowsCoverageRun = process.platform === 'win32' && isCoverageRun

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    setupFiles: ['./src/test/setup.ts'],
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'electron/**/*.test.ts'],
    fileParallelism: !isWindowsCoverageRun,
    maxWorkers: isWindowsCoverageRun ? 1 : undefined,
    minWorkers: isWindowsCoverageRun ? 1 : undefined,
    environmentMatchGlobs: [
      ['electron/**', 'node'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'dist/**',
        'dist-electron/**',
        '**/*.config.*',
        'src/main.tsx',
      ],
      thresholds: {
        statements: 94,
        branches: 88,
        functions: 78,
        lines: 94,
      },
    },
  },
})
