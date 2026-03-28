import { defineConfig } from 'vitest/config'
import path from 'path'

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
