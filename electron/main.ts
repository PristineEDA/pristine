import { app, BrowserWindow, Menu, Tray, nativeImage, screen, type MenuItemConstructorOptions } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_DISPLAY_NAME,
  applicationMenus,
  isAppMenuItem,
  toElectronAccelerator,
  type AppMenuAction,
  type MenuCommandEvent,
} from '../src/app/menu/applicationMenu.js';
import { registerAllHandlers, setProjectRoot, setupWindowStreams } from './ipc/register.js';
import { StreamChannels } from './ipc/channels.js';
import { flushPendingConfigSave, getConfigValue } from './ipc/config.js';
import { disposeLspSession } from './ipc/lsp.js';
import { disposeAllTerminalSessions } from './ipc/terminal.js';
import { DEFAULT_STARTUP_PROJECT_ROOT } from '../src/app/workspace/workspaceFiles.js';
import type { WindowCloseDecision, WindowCloseRequest } from '../src/app/window/windowClose.js';
import { handleAuthCallbackUrl, isAuthProtocolUrl } from './ipc/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MINIMUM_SPLASH_DURATION_MS = 3000;
const CLOSE_ACTION_CONFIG_KEY = 'window.closeActionPreference';
const FLOATING_INFO_VISIBLE_CONFIG_KEY = 'ui.floatingInfoWindow.visible';
const AUTH_CALLBACK_PROTOCOL = 'pristine';
const FLOATING_INFO_WINDOW_TITLE = 'Pristine Floating Info';
const FLOATING_INFO_WINDOW_WIDTH = 60;
const FLOATING_INFO_WINDOW_HEIGHT = 24;

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let floatingInfoWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let nextWindowCloseRequestId = 1;
let pendingWindowCloseRequest: WindowCloseRequest | null = null;
let pendingAuthCallbackUrl: string | null = null;

app.setName(APP_DISPLAY_NAME);

function configureElectronStoragePaths(): void {
  const isDev = Boolean(process.env['VITE_DEV_SERVER_URL']);
  const configuredUserDataPath = process.env['PRISTINE_USER_DATA_PATH'];
  const userDataPath = configuredUserDataPath ?? (
    isDev
      ? path.join(app.getPath('appData'), 'Pristine', 'dev-profile')
      : path.join(app.getPath('appData'), app.getName())
  );
  const sessionDataPath = path.join(userDataPath, 'session-data');

  fs.mkdirSync(sessionDataPath, { recursive: true });
  app.setPath('userData', userDataPath);
  app.setPath('sessionData', sessionDataPath);
}

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function findAuthCallbackUrl(args: readonly string[]): string | null {
  return args.find((value) => isAuthProtocolUrl(value)) ?? null;
}

function registerDeepLinkProtocol(): void {
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient(AUTH_CALLBACK_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    return;
  }

  app.setAsDefaultProtocolClient(AUTH_CALLBACK_PROTOCOL);
}

function processAuthCallbackUrl(url: string): void {
  pendingAuthCallbackUrl = url;
  void handleAuthCallbackUrl(url).then(() => {
    if (pendingAuthCallbackUrl === url) {
      pendingAuthCallbackUrl = null;
    }
  });
}

function sendMenuCommandToMainWindow(payload: MenuCommandEvent): void {
  const window = getMainWindow();
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send(StreamChannels.MENU_COMMAND, payload);
}

function sendWindowCloseRequestToMainWindow(payload: WindowCloseRequest): void {
  const window = getMainWindow();
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) {
    return;
  }

  window.webContents.send(StreamChannels.WINDOW_CLOSE_REQUEST, payload);
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

function openRendererDialogFromApplicationMenu(action: Extract<AppMenuAction, 'open-settings' | 'open-about'>): void {
  const existingWindow = mainWindow;

  showMainWindow();

  const window = mainWindow;
  if (!window || window.isDestroyed()) {
    return;
  }

  if (existingWindow && existingWindow === window) {
    sendMenuCommandToMainWindow({ action });
    return;
  }

  window.once('ready-to-show', () => {
    if (mainWindow === window) {
      sendMenuCommandToMainWindow({ action });
    }
  });
}

function handleApplicationMenuAction(action: AppMenuAction): void {
  if (action === 'open-settings' || action === 'open-about') {
    openRendererDialogFromApplicationMenu(action);
    return;
  }

  if (action === 'save-file' || action === 'save-all-files' || action === 'undo-editor' || action === 'redo-editor') {
    sendMenuCommandToMainWindow({ action });
    return;
  }

  if (action === 'close-app') {
    mainWindow?.close();
  }
}

function requestApplicationQuit(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    requestRendererWindowClose('quit');
    return;
  }

  app.quit();
}

function createMacOSApplicationMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: APP_DISPLAY_NAME,
      submenu: [
        {
          label: `About ${APP_DISPLAY_NAME}`,
          click: () => {
            openRendererDialogFromApplicationMenu('open-about');
          },
        },
        { type: 'separator' },
        {
          label: `Hide ${APP_DISPLAY_NAME}`,
          role: 'hide',
        },
        {
          label: 'Hide Others',
          role: 'hideOthers',
        },
        {
          label: 'Show All',
          role: 'unhide',
        },
        { type: 'separator' },
        {
          label: `Quit ${APP_DISPLAY_NAME}`,
          accelerator: 'Command+Q',
          click: () => {
            requestApplicationQuit();
          },
        },
      ],
    },
    ...applicationMenus.map<MenuItemConstructorOptions>((menu) => ({
      label: menu.label,
      submenu: menu.items.map<MenuItemConstructorOptions>((item) => {
        if (!isAppMenuItem(item)) {
          return { type: 'separator' };
        }

        const action = item.action;

        return {
          label: item.name,
          accelerator: toElectronAccelerator(item.shortcut),
          click: action === undefined
            ? undefined
            : () => {
              handleApplicationMenuAction(action);
            },
        } satisfies MenuItemConstructorOptions;
      }),
    })),
  ];

  return Menu.buildFromTemplate(template);
}

function installApplicationMenu(): void {
  if (process.platform !== 'darwin') {
    return;
  }

  Menu.setApplicationMenu(createMacOSApplicationMenu());
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
  pendingWindowCloseRequest = null;

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
        requestApplicationQuit();
      },
    },
  ]);
}

function requestRendererWindowClose(action: 'quit' | 'tray'): void {
  if (pendingWindowCloseRequest) {
    return;
  }

  const request: WindowCloseRequest = {
    requestId: nextWindowCloseRequestId++,
    action,
  };

  pendingWindowCloseRequest = request;
  sendWindowCloseRequestToMainWindow(request);
}

function resolveWindowCloseRequest(requestId: number, decision: WindowCloseDecision): boolean {
  if (!pendingWindowCloseRequest || pendingWindowCloseRequest.requestId !== requestId) {
    return false;
  }

  const { action } = pendingWindowCloseRequest;
  pendingWindowCloseRequest = null;

  if (decision === 'cancel') {
    return true;
  }

  executeCloseAction(action);
  return true;
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
    requestRendererWindowClose(getConfiguredCloseAction());
  });

  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
      pendingWindowCloseRequest = null;
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
configureElectronStoragePaths();
registerDeepLinkProtocol();

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
}

pendingAuthCallbackUrl = findAuthCallbackUrl(process.argv);

app.on('second-instance', (_event, argv) => {
  const nextAuthCallbackUrl = findAuthCallbackUrl(argv);

  if (nextAuthCallbackUrl) {
    processAuthCallbackUrl(nextAuthCallbackUrl);
  }

  showMainWindow();
});

// Register all IPC handlers before window creation
registerAllHandlers(getMainWindow, setFloatingInfoWindowVisible, resolveWindowCloseRequest);

app.whenReady().then(() => {
  installApplicationMenu();
  createTray();
  createStartupWindows();

   if (shouldShowFloatingInfoWindow()) {
    setFloatingInfoWindowVisible(true);
  }

  if (pendingAuthCallbackUrl) {
    processAuthCallbackUrl(pendingAuthCallbackUrl);
  }

  app.on('open-url', (event, url) => {
    event.preventDefault();
    processAuthCallbackUrl(url);
    showMainWindow();
  });

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
  disposeLspSession();
  disposeAllTerminalSessions();
  tray?.destroy();
  tray = null;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
