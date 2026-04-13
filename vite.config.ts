import { defineConfig } from 'vite'
import path from 'path'
import { execFileSync, spawn, type ChildProcess, type StdioOptions } from 'node:child_process'
import electronBinaryPath from 'electron'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

type ManagedElectronChildProcess = ChildProcess & {
  send?: (message: string) => boolean
}

type ViteElectronProcess = NodeJS.Process & {
  electronApp?: ManagedElectronChildProcess
}

type ElectronOnStartArgs = {
  reload: () => void
}

const managedProcess = process as ViteElectronProcess
const electronExecutable = String(electronBinaryPath)
let devElectronApp: ManagedElectronChildProcess | null = null
let isRestartingDevElectronApp = false
let devElectronExitHookRegistered = false
let devElectronLifecycle = Promise.resolve()

function hasMissingProcessError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as NodeJS.ErrnoException).code === 'ESRCH'
  }

  return error instanceof Error && /not found|no such process|no running instance/i.test(error.message)
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return !hasMissingProcessError(error)
  }
}

function killProcessTree(pid: number): void {
  if (!isProcessRunning(pid)) {
    return
  }

  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    } catch {
      // The child may have already exited between the liveness check and taskkill.
    }
    return
  }

  try {
    process.kill(pid, 'SIGTERM')
  } catch {
    // Ignore best-effort shutdown failures.
  }
}

function syncManagedElectronProcess(child: ManagedElectronChildProcess | null): void {
  devElectronApp = child
  managedProcess.electronApp = child ?? undefined
}

function registerDevElectronExitHook(): void {
  if (devElectronExitHookRegistered) {
    return
  }

  devElectronExitHookRegistered = true
  process.once('exit', () => {
    const child = devElectronApp
    syncManagedElectronProcess(null)

    if (child?.pid) {
      killProcessTree(child.pid)
    }
  })
}

function hasActiveDevElectronApp(): boolean {
  return Boolean(devElectronApp?.pid && isProcessRunning(devElectronApp.pid))
}

async function stopDevElectronApp(): Promise<void> {
  const child = devElectronApp
  syncManagedElectronProcess(null)

  if (!child?.pid || !isProcessRunning(child.pid)) {
    return
  }

  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) {
        return
      }

      settled = true
      resolve()
    }

    const timeout = setTimeout(finish, 5000)
    child.once('exit', () => {
      clearTimeout(timeout)
      finish()
    })
    killProcessTree(child.pid!)
  })
}

async function startDevElectronApp(): Promise<void> {
  registerDevElectronExitHook()

  const stdio: StdioOptions = process.platform === 'linux'
    ? ['inherit', 'inherit', 'inherit', 'ignore', 'ipc']
    : ['inherit', 'inherit', 'inherit', 'ipc']

  const child = spawn(electronExecutable, ['.', '--no-sandbox'], {
    stdio,
  }) as ManagedElectronChildProcess

  syncManagedElectronProcess(child)

  child.once('exit', (code) => {
    const shouldExitDevServer = devElectronApp === child && !isRestartingDevElectronApp
    syncManagedElectronProcess(devElectronApp === child ? null : devElectronApp)

    if (shouldExitDevServer) {
      process.exit(code ?? 0)
    }
  })
}

async function restartDevElectronApp(): Promise<void> {
  if (!hasActiveDevElectronApp()) {
    await startDevElectronApp()
    return
  }

  isRestartingDevElectronApp = true

  try {
    await stopDevElectronApp()
    await startDevElectronApp()
  } finally {
    isRestartingDevElectronApp = false
  }
}

async function handleMainProcessStart(): Promise<void> {
  await restartDevElectronApp()
}

async function handlePreloadProcessStart(args: ElectronOnStartArgs): Promise<void> {
  if (!hasActiveDevElectronApp()) {
    await startDevElectronApp()
    return
  }

  args.reload()
}

function queueDevElectronLifecycle(task: () => Promise<void>): Promise<void> {
  devElectronLifecycle = devElectronLifecycle.then(task, task)
  return devElectronLifecycle
}

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
        onstart() {
          return queueDevElectronLifecycle(() => handleMainProcessStart())
        },
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
                  external: ['node-pty', 'vscode-jsonrpc', 'vscode-jsonrpc/node', 'vscode-jsonrpc/node.js'],
            },
          },
        },
      },
      {
        onstart(args) {
          return queueDevElectronLifecycle(() => handlePreloadProcessStart(args))
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
