import { defineConfig, transformWithEsbuild } from 'vite'
import path from 'path'
import { execFileSync, spawn, type ChildProcess, type StdioOptions } from 'node:child_process'
import { createHash } from 'node:crypto'
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

function normalizePathForVite(id: string): string {
  return id.replace(/\\/g, '/')
}

function isVendoredBlockSuitePath(normalizedId: string): boolean {
  return normalizedId.includes('/.pristine-vendor/affine-blocksuite/')
}

function findMatchingBrace(source: string, openBraceIndex: number): number {
  let depth = 0
  let quote: string | null = null
  let escaped = false

  for (let index = openBraceIndex; index < source.length; index += 1) {
    const character = source[index]

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '"' || character === "'" || character === '`') {
      quote = character
      continue
    }

    if (character === '{') {
      depth += 1
    } else if (character === '}') {
      depth -= 1

      if (depth === 0) {
        return index
      }
    }
  }

  return -1
}

function extractTopLevelObjectKeys(source: string): string[] {
  const keys: string[] = []
  let depth = 0
  let quote: string | null = null
  let escaped = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (quote) {
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === '"' || character === "'" || character === '`') {
      quote = character
      continue
    }

    if (character === '{') {
      depth += 1
      continue
    }

    if (character === '}') {
      depth -= 1
      continue
    }

    if (depth === 1 && /[A-Za-z_$]/.test(character)) {
      const start = index
      index += 1

      while (/[A-Za-z0-9_$]/.test(source[index] ?? '')) {
        index += 1
      }

      const key = source.slice(start, index)
      let cursor = index

      while (/\s/.test(source[cursor] ?? '')) {
        cursor += 1
      }

      if (source[cursor] === ':') {
        keys.push(key)
      }
    }
  }

  return keys
}

function createVanillaExtractStubModule(source: string, id: string): string {
  const moduleHash = createHash('sha1').update(normalizePathForVite(id)).digest('hex').slice(0, 8)
  const exportPattern = /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*/g
  const declarations: string[] = []
  let match: RegExpExecArray | null

  while ((match = exportPattern.exec(source))) {
    const exportName = match[1]
    let initializerStart = exportPattern.lastIndex

    while (/\s/.test(source[initializerStart] ?? '')) {
      initializerStart += 1
    }

    if (source[initializerStart] === '{') {
      const objectEnd = findMatchingBrace(source, initializerStart)
      const objectSource = objectEnd === -1 ? '' : source.slice(initializerStart, objectEnd + 1)
      const properties = extractTopLevelObjectKeys(objectSource)
      const objectEntries = properties.map((property) => `${JSON.stringify(property)}: ${JSON.stringify(`ve_${moduleHash}_${exportName}_${property}`)}`)
      declarations.push(`export const ${exportName} = { ${objectEntries.join(', ')} };`)
      continue
    }

    if (source.startsWith('style', initializerStart)) {
      declarations.push(`export const ${exportName} = ${JSON.stringify(`ve_${moduleHash}_${exportName}`)};`)
      continue
    }

    const semicolonIndex = source.indexOf(';', initializerStart)
    const literalSource = semicolonIndex === -1 ? 'undefined' : source.slice(initializerStart, semicolonIndex)
    declarations.push(`export const ${exportName} = ${literalSource};`)
  }

  return declarations.join('\n')
}

function createRuntimeCssModule(exports: Record<string, string | number>, css: string, id: string): string {
  const moduleHash = createHash('sha1').update(normalizePathForVite(id)).digest('hex').slice(0, 8)
  const stylesheetId = `pristine-ve-${moduleHash}`
  const declarations = Object.entries(exports).map(([exportName, value]) => {
    return `export const ${exportName} = ${JSON.stringify(value)};`
  })

  return [
    `const stylesheetId = ${JSON.stringify(stylesheetId)};`,
    `const cssText = ${JSON.stringify(css)};`,
    `if (typeof document !== 'undefined' && !document.getElementById(stylesheetId)) {`,
    `  const style = document.createElement('style');`,
    `  style.id = stylesheetId;`,
    `  style.textContent = cssText;`,
    `  document.head.append(style);`,
    `}`,
    ...declarations,
  ].join('\n')
}

function createKnownVanillaExtractModule(normalizedId: string, id: string): string | null {
  const className = (exportName: string, sourceId = id) => {
    const moduleHash = createHash('sha1').update(normalizePathForVite(sourceId)).digest('hex').slice(0, 8)
    return `ve_${moduleHash}_${exportName}`
  }

  if (normalizedId.endsWith('/blocks/note/src/note-edgeless-block.css.ts')) {
    const edgelessNoteContainer = className('edgelessNoteContainer')
    const collapseButton = className('collapseButton')
    const noteBackground = className('noteBackground')
    const clipContainer = className('clipContainer')
    const collapsedContent = className('collapsedContent')
    const activePadding = 20
    const css = `
.${edgelessNoteContainer} {
  height: 100%;
  padding: 24px;
  box-sizing: border-box;
  pointer-events: all;
  transform-origin: 0 0;
  font-weight: 400;
  line-height: var(--affine-line-height);
}
.${collapseButton} {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  z-index: 2;
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0.2;
  transition: opacity 0.3s;
}
.${collapseButton}:hover {
  opacity: 1;
}
.${collapseButton}.flip {
  transform: translateX(-50%) rotate(180deg);
}
.${noteBackground} {
  position: absolute;
  border-color: var(--affine-black10);
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}
.${edgelessNoteContainer}[data-editing="true"] .${noteBackground} {
  left: -${activePadding}px;
  top: -${activePadding}px;
  width: calc(100% + ${activePadding * 2}px);
  height: calc(100% + ${activePadding * 2}px);
  transition: left 0.3s, top 0.3s, width 0.3s, height 0.3s;
  box-shadow: var(--affine-active-shadow);
}
.${clipContainer} {
  width: 100%;
  height: 100%;
}
.${collapsedContent} {
  position: absolute;
  background: var(--affine-white);
  opacity: 0.5;
  pointer-events: none;
  border: 2px var(--affine-blue) solid;
  border-top: unset;
  border-radius: 0 0 8px 8px;
}`

    return createRuntimeCssModule(
      {
        ACTIVE_NOTE_EXTRA_PADDING: activePadding,
        edgelessNoteContainer,
        collapseButton,
        noteBackground,
        clipContainer,
        collapsedContent,
      },
      css,
      id,
    )
  }

  if (normalizedId.endsWith('/blocks/note/src/components/edgeless-note-background.css.ts')) {
    const background = className('background')
    const noteCssId = id.replace(/components[\\/]edgeless-note-background\.css\.ts$/, 'note-edgeless-block.css.ts')
    const edgelessNoteContainer = className('edgelessNoteContainer', noteCssId)
    const activePadding = 20
    const css = `
.${background} {
  position: absolute;
  border-color: var(--affine-black10);
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}
.${edgelessNoteContainer}[data-editing="true"] .${background} {
  left: -${activePadding}px;
  top: -${activePadding}px;
  width: calc(100% + ${activePadding * 2}px);
  height: calc(100% + ${activePadding * 2}px);
  transition: left 0.3s, top 0.3s, width 0.3s, height 0.3s;
  box-shadow: var(--affine-active-shadow);
}`

    return createRuntimeCssModule({ background }, css, id)
  }

  return null
}

function blocksuiteVanillaExtractStubPlugin() {
  return {
    name: 'pristine-blocksuite-vanilla-extract-stub',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      const normalizedId = normalizePathForVite(id).split('?')[0]

      if (!isVendoredBlockSuitePath(normalizedId) || !normalizedId.endsWith('.css.ts')) {
        return null
      }

      const knownModule = createKnownVanillaExtractModule(normalizedId, id)

      if (knownModule) {
        return {
          code: knownModule,
          map: null,
        }
      }

      return {
        code: createVanillaExtractStubModule(code, id),
        map: null,
      }
    },
  }
}

function blocksuiteSourceTransformPlugin() {
  return {
    name: 'pristine-blocksuite-source-transform',
    enforce: 'pre' as const,
    async transform(code: string, id: string) {
      const normalizedId = normalizePathForVite(id).split('?')[0]

      if (!isVendoredBlockSuitePath(normalizedId) || !/\.tsx?$/.test(normalizedId)) {
        return null
      }

      return transformWithEsbuild(code, id, {
        loader: 'ts',
        target: 'chrome120',
        tsconfigRaw: {
          compilerOptions: {
            useDefineForClassFields: false,
          },
        },
      })
    },
  }
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
    blocksuiteVanillaExtractStubPlugin(),
    blocksuiteSourceTransformPlugin(),
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
    alias: [
      {
        find: /^@\//,
        replacement: `${path.resolve(__dirname, './src')}/`,
      },
    ],
    dedupe: ['react', 'react-dom'],
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],
}))
