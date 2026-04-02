import { defineConfig } from 'vitest/config'
import path from 'path'

const isCoverageRun = process.argv.some((arg) => arg === '--coverage' || arg.startsWith('--coverage.'))
const isCiCoverageRun = process.env['CI'] === 'true' && isCoverageRun
const coverageReporters = isCiCoverageRun ? ['text', 'json-summary', 'lcovonly'] : ['text', 'html']

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: !isCiCoverageRun,
    maxWorkers: isCiCoverageRun ? 1 : undefined,
    projects: [
      {
        extends: true,
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'electron',
          environment: 'node',
          include: ['electron/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: coverageReporters,
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
