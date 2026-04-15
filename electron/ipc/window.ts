import { BrowserWindow, ipcMain } from 'electron';
import { SyncChannels, AsyncChannels, StreamChannels } from './channels.js';

export function registerWindowHandlers(
  getMainWindow: () => BrowserWindow | null,
  setFloatingInfoWindowVisible: (visible: boolean) => boolean = () => false,
): void {
  ipcMain.on(SyncChannels.WINDOW_IS_MAXIMIZED, (event) => {
    const win = getMainWindow();
    event.returnValue = win ? win.isMaximized() || win.isFullScreen() : false;
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

  ipcMain.handle(AsyncChannels.WINDOW_SET_FLOATING_INFO_VISIBILITY, async (_event, visible: unknown) => {
    if (typeof visible !== 'boolean') {
      throw new Error('Expected floating info visibility to be boolean');
    }

    return setFloatingInfoWindowVisible(visible);
  });
}

export function setupWindowStreams(win: BrowserWindow): void {
  const emitWindowLayoutState = () => {
    win.webContents.send(StreamChannels.WINDOW_MAXIMIZED_CHANGE, win.isMaximized() || win.isFullScreen());
  };

  win.on('maximize', () => {
    emitWindowLayoutState();
  });
  win.on('unmaximize', () => {
    emitWindowLayoutState();
  });
  win.on('enter-full-screen', () => {
    emitWindowLayoutState();
  });
  win.on('leave-full-screen', () => {
    emitWindowLayoutState();
  });
}
