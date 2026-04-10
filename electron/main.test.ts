import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

type BrowserWindowInstance = {
  options: Record<string, unknown>;
  loadURL: Mock<(url: string) => void>;
  loadFile: Mock<(filePath: string) => void>;
  webContents: {
    send: Mock<(channel: string, ...args: unknown[]) => void>;
    isDestroyed: Mock<() => boolean>;
  };
  on: Mock<(event: string, handler: (...args: unknown[]) => void) => BrowserWindowInstance>;
  once: Mock<(event: string, handler: (...args: unknown[]) => void) => BrowserWindowInstance>;
  show: Mock<() => void>;
  hide: Mock<() => void>;
  focus: Mock<() => void>;
  setAlwaysOnTop: Mock<(flag: boolean, level?: string) => void>;
  restore: Mock<() => void>;
  isMinimized: Mock<() => boolean>;
  isDestroyed: Mock<() => boolean>;
  close: Mock<() => void>;
  emit: (event: string, ...args: unknown[]) => void;
};

type TrayInstance = {
  setToolTip: Mock<(tooltip: string) => void>;
  setContextMenu: Mock<(menu: unknown) => void>;
  popUpContextMenu: Mock<(menu?: unknown) => void>;
  on: Mock<(event: string, handler: (...args: unknown[]) => void) => TrayInstance>;
  destroy: Mock<() => void>;
  emit: (event: string, ...args: unknown[]) => void;
};

const mocks = vi.hoisted(() => {
  const appHandlers = new Map<string, (...args: unknown[]) => void>();
  const browserWindowInstances: BrowserWindowInstance[] = [];
  const trayInstances: TrayInstance[] = [];
  const mockAppDataPath = 'mock-home/AppData/Roaming';
  const appPaths = new Map<string, string>([
    ['appData', mockAppDataPath],
    ['userData', `${mockAppDataPath}/Pristine`],
    ['sessionData', `${mockAppDataPath}/Pristine/session-data`],
  ]);

  class BrowserWindowMock {
    static getAllWindows = vi.fn(() => browserWindowInstances);

    options: Record<string, unknown>;
    loadURL = vi.fn();
    loadFile = vi.fn();
    webContents = {
      send: vi.fn(),
      isDestroyed: vi.fn(() => false),
    };
    show = vi.fn();
    hide = vi.fn();
    focus = vi.fn();
    setAlwaysOnTop = vi.fn();
    restore = vi.fn();
    isMinimized = vi.fn(() => false);
    isDestroyed = vi.fn(() => false);
    private handlers = new Map<string, (...args: unknown[]) => void>();
    private onceHandlers = new Map<string, (...args: unknown[]) => void>();

    constructor(options: Record<string, unknown>) {
      this.options = options;
      browserWindowInstances.push(this as unknown as BrowserWindowInstance);
    }

    on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      this.handlers.set(event, handler);
      return this;
    });

    once = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      this.onceHandlers.set(event, handler);
      return this;
    });

    close = vi.fn(() => {
      const closeEvent = {
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
      };

      this.emit('close', closeEvent);

      if (!closeEvent.defaultPrevented) {
        this.emit('closed');
      }
    });

    emit(event: string, ...args: unknown[]) {
      this.handlers.get(event)?.(...args);

      const onceHandler = this.onceHandlers.get(event);
      if (onceHandler) {
        this.onceHandlers.delete(event);
        onceHandler(...args);
      }

      if (event === 'closed') {
        const index = browserWindowInstances.indexOf(this as unknown as BrowserWindowInstance);
        if (index >= 0) {
          browserWindowInstances.splice(index, 1);
        }
      }
    }
  }

  class TrayMock {
    setToolTip = vi.fn();
    setContextMenu = vi.fn();
    popUpContextMenu = vi.fn();
    destroy = vi.fn();
    private handlers = new Map<string, (...args: unknown[]) => void>();

    constructor() {
      trayInstances.push(this as unknown as TrayInstance);
    }

    on = vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      this.handlers.set(event, handler);
      return this;
    });

    emit(event: string, ...args: unknown[]) {
      this.handlers.get(event)?.(...args);
    }
  }

  return {
    appHandlers,
    mockAppDataPath,
    appPaths,
    browserWindowInstances,
    trayInstances,
    BrowserWindowMock,
    TrayMock,
    mockMkdirSync: vi.fn(),
    mockWhenReady: vi.fn(() => Promise.resolve()),
    mockAppOn: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      appHandlers.set(event, handler);
    }),
    mockGetPath: vi.fn((name: string) => appPaths.get(name) ?? `mock-${name}`),
    mockSetPath: vi.fn((name: string, value: string) => {
      appPaths.set(name, value);
    }),
    mockGetName: vi.fn(() => 'Pristine'),
    mockQuit: vi.fn(),
    mockBuildFromTemplate: vi.fn((template: unknown[]) => ({ template })),
    mockCreateFromDataURL: vi.fn(() => ({ kind: 'native-image' })),
    mockDisposeAllTerminalSessions: vi.fn(),
    mockFlushPendingConfigSave: vi.fn(),
    mockGetConfigValue: vi.fn<(key: string) => unknown>(() => null),
    mockRegisterAllHandlers: vi.fn(),
    mockSetProjectRoot: vi.fn(),
    mockSetupWindowStreams: vi.fn(),
  };
});

vi.mock('node:fs', () => ({
  default: {
    mkdirSync: (...args: unknown[]) => mocks.mockMkdirSync(...args),
  },
}));

vi.mock('electron', () => ({
  app: {
    getName: mocks.mockGetName,
    getPath: mocks.mockGetPath,
    setPath: mocks.mockSetPath,
    whenReady: mocks.mockWhenReady,
    on: mocks.mockAppOn,
    quit: mocks.mockQuit,
  },
  BrowserWindow: mocks.BrowserWindowMock,
  Menu: {
    buildFromTemplate: mocks.mockBuildFromTemplate,
  },
  Tray: mocks.TrayMock,
  nativeImage: {
    createFromDataURL: mocks.mockCreateFromDataURL,
  },
  screen: {
    getPrimaryDisplay: () => ({
      workArea: {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      },
    }),
  },
}));

vi.mock('./ipc/register.js', () => ({
  registerAllHandlers: (...args: unknown[]) => mocks.mockRegisterAllHandlers(...args),
  setProjectRoot: (...args: unknown[]) => mocks.mockSetProjectRoot(...args),
  setupWindowStreams: (...args: unknown[]) => mocks.mockSetupWindowStreams(...args),
}));

vi.mock('./ipc/terminal.js', () => ({
  disposeAllTerminalSessions: (...args: unknown[]) => mocks.mockDisposeAllTerminalSessions(...args),
}));

vi.mock('./ipc/config.js', () => ({
  flushPendingConfigSave: (...args: unknown[]) => mocks.mockFlushPendingConfigSave(...args),
  getConfigValue: (key: string) => mocks.mockGetConfigValue(key),
}));

const originalPlatform = process.platform;
const originalDevServerUrl = process.env.VITE_DEV_SERVER_URL;
const originalProjectRoot = process.env.PRISTINE_PROJECT_ROOT;

async function importMain(options?: {
  platform?: NodeJS.Platform;
  devServerUrl?: string;
  projectRoot?: string;
  configValues?: Record<string, unknown>;
}) {
  vi.resetModules();
  mocks.appHandlers.clear();
  mocks.browserWindowInstances.length = 0;
  mocks.trayInstances.length = 0;
  mocks.appPaths.clear();
  mocks.appPaths.set('appData', mocks.mockAppDataPath);
  mocks.appPaths.set('userData', path.join(mocks.mockAppDataPath, 'Pristine'));
  mocks.appPaths.set('sessionData', path.join(mocks.mockAppDataPath, 'Pristine', 'session-data'));
  mocks.mockMkdirSync.mockClear();
  mocks.mockWhenReady.mockClear();
  mocks.mockAppOn.mockClear();
  mocks.mockGetName.mockClear();
  mocks.mockGetPath.mockClear();
  mocks.mockSetPath.mockClear();
  mocks.mockQuit.mockClear();
  mocks.mockBuildFromTemplate.mockClear();
  mocks.mockCreateFromDataURL.mockClear();
  mocks.mockDisposeAllTerminalSessions.mockClear();
  mocks.mockFlushPendingConfigSave.mockClear();
  mocks.mockGetConfigValue.mockReset();
  mocks.mockGetConfigValue.mockImplementation((key: string) => options?.configValues?.[key] ?? null);
  mocks.mockRegisterAllHandlers.mockClear();
  mocks.mockSetProjectRoot.mockClear();
  mocks.mockSetupWindowStreams.mockClear();
  mocks.BrowserWindowMock.getAllWindows.mockClear();

  if (options?.devServerUrl) {
    process.env.VITE_DEV_SERVER_URL = options.devServerUrl;
  } else {
    delete process.env.VITE_DEV_SERVER_URL;
  }

  if (options?.projectRoot) {
    process.env.PRISTINE_PROJECT_ROOT = options.projectRoot;
  } else {
    delete process.env.PRISTINE_PROJECT_ROOT;
  }

  Object.defineProperty(process, 'platform', {
    value: options?.platform ?? 'win32',
  });

  await import('./main.ts');
  await Promise.resolve();

  return {
    appHandlers: mocks.appHandlers,
    browserWindowInstances: mocks.browserWindowInstances,
    trayInstances: mocks.trayInstances,
    getMainWindow: mocks.mockRegisterAllHandlers.mock.calls[0]?.[0] as (() => BrowserWindowInstance | null) | undefined,
  };
}

describe('electron main entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();

    if (originalDevServerUrl) {
      process.env.VITE_DEV_SERVER_URL = originalDevServerUrl;
    } else {
      delete process.env.VITE_DEV_SERVER_URL;
    }

    if (originalProjectRoot) {
      process.env.PRISTINE_PROJECT_ROOT = originalProjectRoot;
    } else {
      delete process.env.PRISTINE_PROJECT_ROOT;
    }

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('registers handlers, creates tray and startup windows, and loads the dev server when available', async () => {
    const { browserWindowInstances, trayInstances, getMainWindow } = await importMain({
      platform: 'win32',
      devServerUrl: 'http://127.0.0.1:5173',
    });

    expect(mocks.mockRegisterAllHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.mockSetProjectRoot).toHaveBeenCalledWith('C:\\Users\\maksy\\Desktop\\fpga\\retroSoC');
    expect(mocks.mockMkdirSync).toHaveBeenCalledWith(
      path.join(mocks.mockAppDataPath, 'Pristine', 'dev-profile', 'session-data'),
      { recursive: true },
    );
    expect(mocks.mockSetPath).toHaveBeenCalledWith('userData', path.join(mocks.mockAppDataPath, 'Pristine', 'dev-profile'));
    expect(mocks.mockSetPath).toHaveBeenCalledWith('sessionData', path.join(mocks.mockAppDataPath, 'Pristine', 'dev-profile', 'session-data'));
    expect(trayInstances).toHaveLength(1);
    expect(browserWindowInstances).toHaveLength(2);

    const splashWindow = browserWindowInstances[0];
    const mainWindow = browserWindowInstances[1];

    expect(getMainWindow?.()).toBe(mainWindow);
    expect(trayInstances[0].setToolTip).toHaveBeenCalledWith('Pristine');
    expect(mocks.mockCreateFromDataURL).toHaveBeenCalledTimes(1);
    expect(mocks.mockBuildFromTemplate).toHaveBeenCalledWith([
      expect.objectContaining({ label: 'Open Pristine' }),
      { type: 'separator' },
      expect.objectContaining({ label: 'Quit Pristine' }),
    ]);
    expect(splashWindow.options).toMatchObject({
      width: 720,
      height: 405,
      frame: false,
      resizable: false,
      skipTaskbar: true,
      backgroundColor: '#0b1020',
    });
    expect(splashWindow.loadFile).toHaveBeenCalledWith(expect.stringMatching(/public[\\/]splash\.html$/));

    expect(mainWindow.options).toMatchObject({
      width: 1440,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      frame: false,
      show: false,
      webPreferences: expect.objectContaining({
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        preload: expect.stringMatching(/preload\.mjs$/),
      }),
    });
    expect(mocks.mockSetupWindowStreams).toHaveBeenCalledWith(mainWindow);
    expect(mainWindow.loadURL).toHaveBeenCalledWith('http://127.0.0.1:5173');
    expect(mainWindow.loadFile).not.toHaveBeenCalled();
    expect(mainWindow.show).not.toHaveBeenCalled();

    mainWindow.emit('ready-to-show');
    await vi.advanceTimersByTimeAsync(1000);
    expect(mainWindow.show).not.toHaveBeenCalled();
    expect(splashWindow.close).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();
    await Promise.resolve();
    expect(mainWindow.show).toHaveBeenCalledTimes(1);
    expect(splashWindow.close).toHaveBeenCalledTimes(1);

    mainWindow.emit('closed');
    expect(getMainWindow?.()).toBeNull();
    expect(mocks.mockDisposeAllTerminalSessions).not.toHaveBeenCalled();
  });

  it('uses macOS window chrome and loads the built index and splash files in production', async () => {
    const { browserWindowInstances } = await importMain({ platform: 'darwin' });

    expect(mocks.mockMkdirSync).toHaveBeenCalledWith(
      path.join(mocks.mockAppDataPath, 'Pristine', 'session-data'),
      { recursive: true },
    );
    expect(mocks.mockSetPath).toHaveBeenCalledWith('userData', path.join(mocks.mockAppDataPath, 'Pristine'));
    expect(mocks.mockSetPath).toHaveBeenCalledWith('sessionData', path.join(mocks.mockAppDataPath, 'Pristine', 'session-data'));

    const splashWindow = browserWindowInstances[0];
    const mainWindow = browserWindowInstances[1];

    expect(mainWindow.options).toMatchObject({
      frame: true,
      show: false,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 10 },
    });
    expect(mainWindow.loadFile).toHaveBeenCalledWith(expect.stringMatching(/dist[\\/]index\.html$/));
    expect(mainWindow.loadURL).not.toHaveBeenCalled();
    expect(splashWindow.loadFile).toHaveBeenCalledWith(expect.stringMatching(/dist[\\/]splash\.html$/));
  });

  it('creates the detached floating info window when enabled in config', async () => {
    const { browserWindowInstances } = await importMain({
      platform: 'win32',
      configValues: {
        'ui.floatingInfoWindow.visible': true,
      },
    });

    expect(browserWindowInstances).toHaveLength(3);

    const floatingInfoWindow = browserWindowInstances[2];
    expect(floatingInfoWindow.options).toMatchObject({
      width: 60,
      height: 24,
      frame: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      title: 'Pristine Floating Info',
    });
    expect(floatingInfoWindow.show).toHaveBeenCalledTimes(1);
    expect(floatingInfoWindow.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
    expect(floatingInfoWindow.loadFile).toHaveBeenCalledWith(expect.stringMatching(/dist[\\/]floating-info\.html$/));
  });

  it('recreates splash and main windows on activate when all windows are closed', async () => {
    const { appHandlers, browserWindowInstances } = await importMain({ platform: 'darwin' });

    expect(browserWindowInstances).toHaveLength(2);

    browserWindowInstances[1].emit('closed');
    mocks.BrowserWindowMock.getAllWindows.mockReturnValueOnce([]);
    appHandlers.get('activate')?.();

    expect(browserWindowInstances).toHaveLength(3);
  });

  it('shows the existing main window on activate when it is already available', async () => {
    const { appHandlers, browserWindowInstances } = await importMain({ platform: 'win32' });

    const mainWindow = browserWindowInstances[1];
    mainWindow.show.mockClear();
    mainWindow.focus.mockClear();

    appHandlers.get('activate')?.();

    expect(mainWindow.show).toHaveBeenCalledTimes(1);
    expect(mainWindow.focus).toHaveBeenCalledTimes(1);
  });

  it('opens the tray menu on click and tray actions can show or quit the app', async () => {
    const { browserWindowInstances, trayInstances } = await importMain({ platform: 'win32' });

    const tray = trayInstances[0];
    const mainWindow = browserWindowInstances[1];
    const { template } = mocks.mockBuildFromTemplate.mock.results[0].value as {
      template: Array<{ label?: string; click?: () => void }>;
    };
    const openItem = template.find((item) => item.label === 'Open Pristine');
    const quitItem = template.find((item) => item.label === 'Quit Pristine');

    tray.emit('click');
    expect(tray.popUpContextMenu).toHaveBeenCalledTimes(1);

    mainWindow.show.mockClear();
    mainWindow.focus.mockClear();
    openItem?.click?.();
    expect(mainWindow.show).toHaveBeenCalledTimes(1);
    expect(mainWindow.focus).toHaveBeenCalledTimes(1);

    quitItem?.click?.();
    expect(mocks.mockQuit).toHaveBeenCalledTimes(1);
  });

  it('quits on native close when close-to-tray is not enabled', async () => {
    const { browserWindowInstances } = await importMain({ platform: 'win32' });

    const mainWindow = browserWindowInstances[1];
    mainWindow.close();

    expect(mainWindow.hide).not.toHaveBeenCalled();
    expect(mocks.mockQuit).toHaveBeenCalledTimes(1);
  });

  it('hides to tray on native close when the configured choice is tray', async () => {
    const { browserWindowInstances } = await importMain({
      platform: 'win32',
      configValues: {
        'window.closeActionPreference': 'tray',
      },
    });

    const mainWindow = browserWindowInstances[1];
    mainWindow.close();

    expect(mainWindow.hide).toHaveBeenCalledTimes(1);
    expect(mocks.mockQuit).not.toHaveBeenCalled();
  });

  it('quits on native close when the configured choice is quit', async () => {
    const { browserWindowInstances } = await importMain({
      platform: 'win32',
      configValues: {
        'window.closeActionPreference': 'quit',
      },
    });

    browserWindowInstances[1].close();

    expect(mocks.mockQuit).toHaveBeenCalledTimes(1);
  });

  it('quits the app when all windows are closed on non-macOS platforms', async () => {
    const { appHandlers } = await importMain({ platform: 'win32' });

    appHandlers.get('window-all-closed')?.();
    expect(mocks.mockQuit).toHaveBeenCalledTimes(1);
  });

  it('keeps the app running when all windows are closed on macOS', async () => {
    const { appHandlers } = await importMain({ platform: 'darwin' });

    appHandlers.get('window-all-closed')?.();
    expect(mocks.mockQuit).not.toHaveBeenCalled();
  });

  it('disposes terminal sessions and destroys the tray only during app quit', async () => {
    const { appHandlers, trayInstances } = await importMain({ platform: 'win32' });

    appHandlers.get('before-quit')?.();

    expect(mocks.mockFlushPendingConfigSave).toHaveBeenCalledTimes(1);
    expect(mocks.mockDisposeAllTerminalSessions).toHaveBeenCalledTimes(1);
    expect(trayInstances[0].destroy).toHaveBeenCalledTimes(1);
  });
});
