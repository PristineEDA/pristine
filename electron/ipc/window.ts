import { BrowserWindow, ipcMain } from 'electron';
import { SyncChannels, AsyncChannels, StreamChannels } from './channels.js';

export function registerWindowHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.on(SyncChannels.WINDOW_IS_MAXIMIZED, (event) => {
    const win = getMainWindow();
    event.returnValue = win ? win.isMaximized() : false;
  });

  ipcMain.handle(AsyncChannels.WINDOW_MINIMIZE, () => {
    getMainWindow()?.minimize();
  });

  ipcMain.handle(AsyncChannels.WINDOW_MAXIMIZE, () => {
    const win = getMainWindow();
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle(AsyncChannels.WINDOW_CLOSE, () => {
    getMainWindow()?.close();
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
