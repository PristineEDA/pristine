import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerAllHandlers, setProjectRoot, setupWindowStreams } from './ipc/register.js';
import { getConfigValue } from './ipc/config.js';
import { disposeAllTerminalSessions } from './ipc/terminal.js';
import { StreamChannels } from './ipc/channels.js';
import { DEFAULT_STARTUP_PROJECT_ROOT } from '../src/app/workspace/workspaceFiles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MINIMUM_SPLASH_DURATION_MS = 3000;
const CLOSE_ACTION_CONFIG_KEY = 'window.closeActionPreference';

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

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

function createTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <rect width="16" height="16" rx="4" fill="#0f172a"/>
      <path d="M5 3.5h3.9c2.04 0 3.1 1.03 3.1 2.78 0 1.16-.52 1.96-1.47 2.39.79.28 1.72 1.01 1.72 2.59 0 2.03-1.32 3.24-3.64 3.24H5V3.5Zm2.08 4.44h1.52c.89 0 1.38-.45 1.38-1.25 0-.77-.49-1.17-1.38-1.17H7.08v2.42Zm0 4.54h1.73c1.05 0 1.58-.46 1.58-1.37 0-.9-.53-1.34-1.58-1.34H7.08v2.71Z" fill="#f8fafc"/>
    </svg>
  `.trim();

  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createStartupWindows();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindowToTray(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.hide();
}

function requestCloseConfirmation(window: BrowserWindow): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send(StreamChannels.WINDOW_CLOSE_REQUESTED);
}

function getRememberedCloseAction(): 'quit' | 'tray' | null {
  const value = getConfigValue(CLOSE_ACTION_CONFIG_KEY);
  return value === 'quit' || value === 'tray' ? value : null;
}

function executeRememberedCloseAction(action: 'quit' | 'tray'): void {
  if (action === 'tray') {
    hideMainWindowToTray();
    return;
  }

  isQuitting = true;
  app.quit();
}

function createTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Open Pristine',
      click: () => {
        showMainWindow();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Pristine',
      click: () => {
        app.quit();
      },
    },
  ]);
}

function createTray(): Tray {
  if (tray) {
    return tray;
  }

  const nextTray = new Tray(createTrayIcon());
  const trayMenu = createTrayMenu();

  nextTray.setToolTip('Pristine');
  nextTray.setContextMenu(trayMenu);
  nextTray.on('click', () => {
    nextTray.popUpContextMenu(trayMenu);
  });

  tray = nextTray;
  return nextTray;
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

  window.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();

    const rememberedCloseAction = getRememberedCloseAction();
    if (rememberedCloseAction) {
      executeRememberedCloseAction(rememberedCloseAction);
      return;
    }

    requestCloseConfirmation(window);
  });

  window.on('closed', () => {
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
  createTray();
  createStartupWindows();

  app.on('activate', () => {
    if (mainWindow) {
      showMainWindow();
      return;
    }

    if (BrowserWindow.getAllWindows().length === 0) {
      createStartupWindows();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  disposeAllTerminalSessions();
  tray?.destroy();
  tray = null;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
