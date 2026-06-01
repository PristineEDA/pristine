import { app, ipcMain } from 'electron';
import { AsyncChannels, SyncChannels } from './channels.js';
import type { ElectronGpuDiagnostics, ElectronGpuInfo } from '../../types/electron-gpu.js';

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

  ipcMain.handle(AsyncChannels.PLATFORM_GET_GPU_DIAGNOSTICS, async (): Promise<ElectronGpuDiagnostics> => {
    let info: ElectronGpuInfo | null = null;
    let infoError: string | null = null;

    try {
      info = await app.getGPUInfo('basic') as ElectronGpuInfo;
    } catch (error) {
      infoError = error instanceof Error ? error.message : String(error);
    }

    return {
      hardwareAccelerationEnabled: getHardwareAccelerationEnabled(),
      featureStatus: app.getGPUFeatureStatus() as unknown as Record<string, string>,
      info,
      infoError,
    };
  });
}

function getHardwareAccelerationEnabled() {
  const electronApp = app as typeof app & {
    isHardwareAccelerationEnabled?: () => boolean;
  };

  return electronApp.isHardwareAccelerationEnabled?.() ?? true;
}
