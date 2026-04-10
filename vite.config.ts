import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

export default defineConfig(() => ({
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        floatingInfo: path.resolve(__dirname, 'floating-info.html'),
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    ...electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              output: {
                manualChunks(id) {
                  if (id.includes('@monaco-editor/react') || id.includes('monaco-editor')) {
                    return 'monaco'
                  }

                  if (id.includes('@xterm')) {
                    return 'xterm'
                  }

                  if (id.includes('lucide-react')) {
                    return 'icons'
                  }
                },
              },
              external: ['node-pty'],
            },
          },
        },
      },
      {
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            lib: {
              entry: 'electron/preload.ts',
              formats: ['cjs'],
              fileName: () => 'preload.mjs',
            },
            rollupOptions: {
              output: {
                assetFileNames: '[name].[ext]',
              },
            },
            rolldownOptions: {
              output: {
                codeSplitting: false,
              },
            },
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],
}))
