import { vi } from 'vitest';
import type { ElectronAPI } from '../../types/electron-api';

const defaultGpuDiagnostics = {
  hardwareAccelerationEnabled: true,
  featureStatus: {
    gpu_compositing: 'enabled',
    webgl: 'enabled',
    webgpu: 'enabled',
  },
  info: {
    auxAttributes: {
      glResetNotificationStrategy: 0,
    },
    gpuDevice: [{ active: true, deviceId: 1234, vendorId: 4321 }],
  },
  infoError: null,
};

export function createElectronApiMock(): ElectronAPI {
  return {
    platform: 'win32',
    arch: 'x64',
    isE2E: false,
    versions: {
      electron: '35.0.0',
      node: process.versions.node,
      chrome: '130.0.0.0',
    },
    minimize: vi.fn(),
    maximize: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    close: vi.fn(),
    resolveCloseRequest: vi.fn(),
    setFloatingInfoWindowVisible: vi.fn(),
    setFloatingInfoWindowExpanded: vi.fn(),
    isMaximized: vi.fn(() => false),
    isFullScreen: vi.fn(() => false),
    onMaximizedChange: vi.fn(() => vi.fn()),
    onFullScreenChange: vi.fn(() => vi.fn()),
    onCloseRequested: vi.fn(() => vi.fn()),
    onWindowFocus: vi.fn(() => vi.fn()),
    onWorkspaceChange: vi.fn(() => vi.fn()),
    gpu: {
      getDiagnostics: vi.fn().mockResolvedValue(defaultGpuDiagnostics),
    },
    fs: {
      readFile: vi.fn().mockResolvedValue(''),
      readFileAbsolute: vi.fn().mockResolvedValue(''),
      listFiles: vi.fn().mockResolvedValue([]),
      writeFile: vi.fn(),
      writeFileAbsolute: vi.fn(),
      createDirectory: vi.fn(),
      copyFile: vi.fn(),
      copyDirectory: vi.fn(),
      deleteFile: vi.fn(),
      deleteDirectory: vi.fn(),
      rename: vi.fn(),
      readDir: vi.fn().mockResolvedValue([]),
      stat: vi.fn(),
      exists: vi.fn().mockResolvedValue(false),
    },
    dialog: {
      showSaveDialog: vi.fn().mockResolvedValue({
        canceled: true,
        filePath: null,
        workspaceRelativePath: null,
      }),
      showOpenThemeDialog: vi.fn().mockResolvedValue({
        canceled: true,
        filePath: null,
      }),
    },
    git: {
      getStatus: vi.fn().mockResolvedValue({
        branchName: null,
        hasProjectFiles: false,
        isGitRepo: false,
        pathStates: {},
      }),
      getFileDiff: vi.fn().mockResolvedValue({
        filePath: '',
        originalContent: '',
        currentContent: '',
      }),
    },
    shell: {
      exec: vi.fn(),
      kill: vi.fn(),
      onStdout: vi.fn(() => vi.fn()),
      onStderr: vi.fn(() => vi.fn()),
      onExit: vi.fn(() => vi.fn()),
    },
    terminal: {
      create: vi.fn().mockResolvedValue({ id: 'terminal-1', pid: 100, shell: 'powershell.exe' }),
      write: vi.fn().mockResolvedValue(true),
      resize: vi.fn().mockResolvedValue(true),
      kill: vi.fn().mockResolvedValue(true),
      onData: vi.fn(() => vi.fn()),
      onExit: vi.fn(() => vi.fn()),
    },
    lsp: {
      openDocument: vi.fn().mockResolvedValue(undefined),
      changeDocument: vi.fn().mockResolvedValue(undefined),
      closeDocument: vi.fn().mockResolvedValue(undefined),
      completion: vi.fn().mockResolvedValue(null),
      hover: vi.fn().mockResolvedValue(null),
      definition: vi.fn().mockResolvedValue([]),
      references: vi.fn().mockResolvedValue([]),
      moduleHierarchy: vi.fn().mockResolvedValue({ roots: [], messages: [] }),
      schematic: vi.fn().mockResolvedValue({ rootModuleId: null, modules: [], messages: [] }),
      onDebug: vi.fn(() => vi.fn()),
      onDiagnostics: vi.fn(() => vi.fn()),
      onState: vi.fn(() => vi.fn()),
    },
    menu: {
      onCommand: vi.fn(() => vi.fn()),
    },
    notices: {
      revealBundledFiles: vi.fn().mockResolvedValue(true),
    },
    auth: {
      openAccountPage: vi.fn().mockResolvedValue(true),
      getSession: vi.fn().mockResolvedValue(null),
      signOut: vi.fn().mockResolvedValue(true),
      syncCloudConfig: vi.fn().mockResolvedValue(true),
      onStateChanged: vi.fn(() => vi.fn()),
      onError: vi.fn(() => vi.fn()),
    },
    config: {
      get: vi.fn(),
      set: vi.fn(),
      onDidChange: vi.fn(() => vi.fn()),
    },
  };
}
