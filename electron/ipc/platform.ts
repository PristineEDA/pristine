import { ipcMain } from 'electron';
import { SyncChannels } from './channels.js';

export function registerPlatformHandler(): void {
  ipcMain.on(SyncChannels.PLATFORM, (event) => {
    event.returnValue = {
      platform: process.platform,
      arch: process.arch,
      isE2E: process.env['PRISTINE_E2E'] === '1',
      versions: {
        electron: process.versions['electron'],
        node: process.versions['node'],
        chrome: process.versions['chrome'],
      },
    };
  });
}
