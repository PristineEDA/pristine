import { app, BrowserWindow, ipcMain } from 'electron';
import { SyncChannels, AsyncChannels, StreamChannels } from './channels.js';
import { setConfigValue } from './config.js';

const CLOSE_ACTION_CONFIG_KEY = 'window.closeActionPreference';

export function registerWindowHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.on(SyncChannels.WINDOW_IS_MAXIMIZED, (event) => {
    const win = getMainWindow();
    event.returnValue = win ? win.isMaximized() : false;
  });

  ipcMain.handle(AsyncChannels.WINDOW_MINIMIZE, () => {
    const win = getMainWindow();
    if (!win) return false;
    win.minimize();
    return true;
  });

  ipcMain.handle(AsyncChannels.WINDOW_MAXIMIZE, () => {
    const win = getMainWindow();
    if (!win) return false;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
    return win.isMaximized();
  });

  ipcMain.handle(AsyncChannels.WINDOW_SHOW, () => {
    const win = getMainWindow();
    if (!win) return false;
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    win.focus();
    return true;
  });

  ipcMain.handle(AsyncChannels.WINDOW_HIDE, () => {
    const win = getMainWindow();
    if (!win) return false;
    win.hide();
    return true;
  });

  ipcMain.handle(AsyncChannels.WINDOW_CLOSE, () => {
    const win = getMainWindow();
    if (!win) return false;
    win.close();
    return true;
  });

  ipcMain.handle(AsyncChannels.WINDOW_RESOLVE_CLOSE, async (_event, action: unknown, remember: unknown) => {
    const win = getMainWindow();
    if (!win) return false;

    if (action !== 'quit' && action !== 'tray') {
      throw new Error('Expected close action to be "quit" or "tray"');
    }

    if (typeof remember !== 'boolean') {
      throw new Error('Expected remember to be boolean');
    }

    if (remember) {
      setConfigValue(CLOSE_ACTION_CONFIG_KEY, action);
    }

    if (action === 'tray') {
      win.hide();
      return true;
    }

    app.quit();
    return true;
  });
}

export function setupWindowStreams(win: BrowserWindow): void {
  win.on('maximize', () => {
    win.webContents.send(StreamChannels.WINDOW_MAXIMIZED_CHANGE, true);
  });
  win.on('unmaximize', () => {
    win.webContents.send(StreamChannels.WINDOW_MAXIMIZED_CHANGE, false);
  });
}
