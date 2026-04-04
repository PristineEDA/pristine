import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerAllHandlers, setProjectRoot, setupWindowStreams } from './ipc/register.js';
import { disposeAllTerminalSessions } from './ipc/terminal.js';
import { DEFAULT_STARTUP_PROJECT_ROOT } from '../src/app/workspace/workspaceFiles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MINIMUM_SPLASH_DURATION_MS = 3000;

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function getPreloadPath(): string {
  return path.join(__dirname, 'preload.mjs');
}

function getMainRendererPath(): string {
  return path.join(__dirname, '../dist/index.html');
}

function getSplashHtmlPath(): string {
  return process.env['VITE_DEV_SERVER_URL']
    ? path.join(__dirname, '../public/splash.html')
    : path.join(__dirname, '../dist/splash.html');
}

function createSplashWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 720,
    height: 405,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    show: true,
    center: true,
    skipTaskbar: true,
    backgroundColor: '#0b1020',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  window.loadFile(getSplashHtmlPath());
  window.on('closed', () => {
    if (splashWindow === window) {
      splashWindow = null;
    }
  });

  splashWindow = window;
  return window;
}

function createMainWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin';
  const preloadFile = getPreloadPath();

  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: isMac,
    show: false,
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
    trafficLightPosition: isMac ? { x: 12, y: 10 } : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: preloadFile,
      webSecurity: true,
    },
  });

  mainWindow = window;
  setupWindowStreams(window);

  // Dev mode: load Vite dev server; Prod mode: load built files
  if (process.env['VITE_DEV_SERVER_URL']) {
    window.loadURL(process.env['VITE_DEV_SERVER_URL']);
  } else {
    window.loadFile(getMainRendererPath());
  }

  window.on('close', () => {
    disposeAllTerminalSessions();
  });

  window.on('closed', () => {
    disposeAllTerminalSessions();
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  return window;
}

function waitForWindowReady(window: BrowserWindow): Promise<void> {
  return new Promise((resolve) => {
    window.once('ready-to-show', () => {
      resolve();
    });
  });
}

function waitForMinimumSplashDuration(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, MINIMUM_SPLASH_DURATION_MS);
  });
}

function showMainWindowWhenReady(window: BrowserWindow, splash: BrowserWindow): void {
  void Promise.all([waitForWindowReady(window), waitForMinimumSplashDuration()]).then(() => {
    if (mainWindow === window) {
      window.show();
    }

    if (splashWindow === splash) {
      splash.close();
    }
  });
}

function createStartupWindows(): void {
  const splash = createSplashWindow();
  const window = createMainWindow();

  showMainWindowWhenReady(window, splash);
}

setProjectRoot(process.env['PRISTINE_PROJECT_ROOT'] ?? DEFAULT_STARTUP_PROJECT_ROOT);

// Register all IPC handlers before window creation
registerAllHandlers(getMainWindow);

app.whenReady().then(() => {
  createStartupWindows();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createStartupWindows();
    }
  });
});

app.on('before-quit', () => {
  disposeAllTerminalSessions();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
