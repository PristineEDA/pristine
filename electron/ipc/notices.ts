import { app, ipcMain, shell } from 'electron';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { AsyncChannels } from './channels.js';

export function getBundledNoticeFilePath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'licenses', 'NOTICE');
  }

  return path.join(app.getAppPath(), 'NOTICE');
}

export async function revealBundledNoticeFiles(): Promise<boolean> {
  const noticeFilePath = getBundledNoticeFilePath();

  try {
    await access(noticeFilePath);
    shell.showItemInFolder(noticeFilePath);
    return true;
  } catch {
    return false;
  }
}

export function registerNoticeHandlers(): void {
  ipcMain.handle(AsyncChannels.NOTICES_REVEAL_BUNDLED_FILES, async () => {
    return revealBundledNoticeFiles();
  });
}