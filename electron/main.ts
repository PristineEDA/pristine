import { app, BrowserWindow, Menu, Tray, nativeImage, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerAllHandlers, setProjectRoot, setupWindowStreams } from './ipc/register.js';
import { flushPendingConfigSave, getConfigValue } from './ipc/config.js';
import { disposeAllTerminalSessions } from './ipc/terminal.js';
import { DEFAULT_STARTUP_PROJECT_ROOT } from '../src/app/workspace/workspaceFiles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MINIMUM_SPLASH_DURATION_MS = 3000;
const CLOSE_ACTION_CONFIG_KEY = 'window.closeActionPreference';
const FLOATING_INFO_VISIBLE_CONFIG_KEY = 'ui.floatingInfoWindow.visible';
const FLOATING_INFO_WINDOW_TITLE = 'Pristine Floating Info';
const FLOATING_INFO_WINDOW_WIDTH = 60;
const FLOATING_INFO_WINDOW_HEIGHT = 24;

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let floatingInfoWindow: BrowserWindow | null = null;
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

function getFloatingInfoRendererPath(): string {
  return path.join(__dirname, '../dist/floating-info.html');
}

function getSplashHtmlPath(): string {
  return process.env['VITE_DEV_SERVER_URL']
    ? path.join(__dirname, '../public/splash.html')
    : path.join(__dirname, '../dist/splash.html');
}

function getFloatingInfoRendererUrl(): string {
  return new URL('floating-info.html', process.env['VITE_DEV_SERVER_URL']).toString();
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

function shouldShowFloatingInfoWindow(): boolean {
  return getConfigValue(FLOATING_INFO_VISIBLE_CONFIG_KEY) === true;
}

function getFloatingInfoWindowPosition() {
  const { workArea } = screen.getPrimaryDisplay();

  return {
    x: workArea.x + workArea.width - FLOATING_INFO_WINDOW_WIDTH - 24,
    y: workArea.y + 24,
  };
}

function createFloatingInfoWindow(): BrowserWindow {
  if (floatingInfoWindow && !floatingInfoWindow.isDestroyed()) {
    return floatingInfoWindow;
  }

  const { x, y } = getFloatingInfoWindowPosition();
  const window = new BrowserWindow({
    width: FLOATING_INFO_WINDOW_WIDTH,
    height: FLOATING_INFO_WINDOW_HEIGHT,
    minWidth: FLOATING_INFO_WINDOW_WIDTH,
    maxWidth: FLOATING_INFO_WINDOW_WIDTH,
    minHeight: FLOATING_INFO_WINDOW_HEIGHT,
    maxHeight: FLOATING_INFO_WINDOW_HEIGHT,
    x,
    y,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    show: false,
    title: FLOATING_INFO_WINDOW_TITLE,
    backgroundColor: '#111827',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  if (process.env['VITE_DEV_SERVER_URL']) {
    window.loadURL(getFloatingInfoRendererUrl());
  } else {
    window.loadFile(getFloatingInfoRendererPath());
  }

  window.setAlwaysOnTop(true, 'screen-saver');
  window.on('closed', () => {
    if (floatingInfoWindow === window) {
      floatingInfoWindow = null;
    }
  });

  floatingInfoWindow = window;
  return window;
}

function setFloatingInfoWindowVisible(visible: boolean): boolean {
  if (visible) {
    const window = createFloatingInfoWindow();
    window.show();
    return true;
  }

  if (!floatingInfoWindow || floatingInfoWindow.isDestroyed()) {
    return false;
  }

  floatingInfoWindow.hide();
  return true;
}

function getConfiguredCloseAction(): 'quit' | 'tray' {
  const value = getConfigValue(CLOSE_ACTION_CONFIG_KEY);
  return value === 'tray' ? 'tray' : 'quit';
}

function executeCloseAction(action: 'quit' | 'tray'): void {
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
    executeCloseAction(getConfiguredCloseAction());
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
registerAllHandlers(getMainWindow, setFloatingInfoWindowVisible);

app.whenReady().then(() => {
  createTray();
  createStartupWindows();

   if (shouldShowFloatingInfoWindow()) {
    setFloatingInfoWindowVisible(true);
  }

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
  flushPendingConfigSave();
  disposeAllTerminalSessions();
  tray?.destroy();
  tray = null;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
