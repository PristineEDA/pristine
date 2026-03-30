import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerAllHandlers, setProjectRoot, setupWindowStreams } from './ipc/register.js';
import { disposeAllTerminalSessions } from './ipc/terminal.js';
import { DEFAULT_STARTUP_PROJECT_ROOT } from '../src/app/workspace/workspaceFiles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function createWindow(): void {
  const isMac = process.platform === 'darwin';
  const preloadFile = path.join(__dirname, 'preload.mjs');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    frame: isMac,
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

  setupWindowStreams(mainWindow);

  // Dev mode: load Vite dev server; Prod mode: load built files
  if (process.env['VITE_DEV_SERVER_URL']) {
    mainWindow.loadURL(process.env['VITE_DEV_SERVER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('close', () => {
    disposeAllTerminalSessions();
  });

  mainWindow.on('closed', () => {
    disposeAllTerminalSessions();
    mainWindow = null;
  });
}

setProjectRoot(process.env['PRISTINE_PROJECT_ROOT'] ?? DEFAULT_STARTUP_PROJECT_ROOT);

// Register all IPC handlers before window creation
registerAllHandlers(getMainWindow);

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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
