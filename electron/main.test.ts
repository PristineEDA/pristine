import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type BrowserWindowInstance = {
  options: Record<string, unknown>;
  loadURL: ReturnType<typeof vi.fn>;
  loadFile: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  emit: (event: string, ...args: unknown[]) => void;
};

const mocks = vi.hoisted(() => {
  const appHandlers = new Map<string, (...args: unknown[]) => void>();
  const browserWindowInstances: BrowserWindowInstance[] = [];

  class BrowserWindowMock {
    static getAllWindows = vi.fn(() => browserWindowInstances);

    options: Record<string, unknown>;
    loadURL = vi.fn();
    loadFile = vi.fn();
    private handlers = new Map<string, (...args: unknown[]) => void>();

    constructor(options: Record<string, unknown>) {
      this.options = options;
      browserWindowInstances.push(this as unknown as BrowserWindowInstance);
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
    browserWindowInstances,
    BrowserWindowMock,
    mockWhenReady: vi.fn(() => Promise.resolve()),
    mockAppOn: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      appHandlers.set(event, handler);
    }),
    mockQuit: vi.fn(),
    mockRegisterAllHandlers: vi.fn(),
    mockSetProjectRoot: vi.fn(),
    mockSetupWindowStreams: vi.fn(),
  };
});

vi.mock('electron', () => ({
  app: {
    whenReady: mocks.mockWhenReady,
    on: mocks.mockAppOn,
    quit: mocks.mockQuit,
  },
  BrowserWindow: mocks.BrowserWindowMock,
}));

vi.mock('./ipc/register.js', () => ({
  registerAllHandlers: (...args: unknown[]) => mocks.mockRegisterAllHandlers(...args),
  setProjectRoot: (...args: unknown[]) => mocks.mockSetProjectRoot(...args),
  setupWindowStreams: (...args: unknown[]) => mocks.mockSetupWindowStreams(...args),
}));

const originalPlatform = process.platform;
const originalDevServerUrl = process.env.VITE_DEV_SERVER_URL;
const originalProjectRoot = process.env.PRISTINE_PROJECT_ROOT;

async function importMain(options?: { platform?: NodeJS.Platform; devServerUrl?: string; projectRoot?: string }) {
  vi.resetModules();
  mocks.appHandlers.clear();
  mocks.browserWindowInstances.length = 0;
  mocks.mockWhenReady.mockClear();
  mocks.mockAppOn.mockClear();
  mocks.mockQuit.mockClear();
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
    getMainWindow: mocks.mockRegisterAllHandlers.mock.calls[0]?.[0] as (() => BrowserWindowInstance | null) | undefined,
  };
}

describe('electron main entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
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

  it('registers handlers, creates a browser window, and loads the dev server when available', async () => {
    const { browserWindowInstances, getMainWindow } = await importMain({
      platform: 'win32',
      devServerUrl: 'http://127.0.0.1:5173',
    });

    expect(mocks.mockRegisterAllHandlers).toHaveBeenCalledTimes(1);
    expect(mocks.mockSetProjectRoot).toHaveBeenCalledWith('C:\\Users\\maksy\\Desktop\\fpga\\retroSoC');
    expect(browserWindowInstances).toHaveLength(1);
    expect(getMainWindow?.()).toBe(browserWindowInstances[0]);

    const mainWindow = browserWindowInstances[0];

    expect(mainWindow.options).toMatchObject({
      width: 1440,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      frame: false,
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

    mainWindow.emit('closed');
    expect(getMainWindow?.()).toBeNull();
  });

  it('uses macOS window chrome and loads the built index file in production', async () => {
    const { browserWindowInstances } = await importMain({ platform: 'darwin' });

    const mainWindow = browserWindowInstances[0];

    expect(mainWindow.options).toMatchObject({
      frame: true,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 12, y: 10 },
    });
    expect(mainWindow.loadFile).toHaveBeenCalledWith(expect.stringMatching(/dist[\\/]index\.html$/));
    expect(mainWindow.loadURL).not.toHaveBeenCalled();
  });

  it('recreates the main window on activate when all windows are closed', async () => {
    const { appHandlers, browserWindowInstances } = await importMain({ platform: 'darwin' });

    expect(browserWindowInstances).toHaveLength(1);

    mocks.BrowserWindowMock.getAllWindows.mockReturnValueOnce([]);
    appHandlers.get('activate')?.();

    expect(browserWindowInstances).toHaveLength(2);
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

  it('allows tests to override the startup project root via environment variable', async () => {
    await importMain({ projectRoot: 'D:\\fixture-workspace' });

    expect(mocks.mockSetProjectRoot).toHaveBeenCalledWith('D:\\fixture-workspace');
  });
});