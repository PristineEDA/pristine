import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AsyncChannels, SyncChannels } from './channels.js';

const mockOn = vi.fn();
const mockHandle = vi.fn();
const mockGetGPUInfo = vi.fn<(infoType: string) => Promise<Record<string, unknown>>>(async () => ({
  auxAttributes: {
    glResetNotificationStrategy: 0,
  },
  gpuDevice: [{ active: true, deviceId: 1234, vendorId: 4321 }],
}));
const mockGetGPUFeatureStatus = vi.fn(() => ({
  gpu_compositing: 'enabled',
  webgl: 'enabled',
  webgpu: 'enabled',
}));
const mockIsHardwareAccelerationEnabled = vi.fn(() => true);

vi.mock('electron', () => ({
  app: {
    getGPUFeatureStatus: () => mockGetGPUFeatureStatus(),
    getGPUInfo: (infoType: string) => mockGetGPUInfo(infoType),
    isHardwareAccelerationEnabled: () => mockIsHardwareAccelerationEnabled(),
  },
  ipcMain: {
    on: (...args: unknown[]) => mockOn(...args),
    handle: (...args: unknown[]) => mockHandle(...args),
  },
}));

import { registerPlatformHandler } from './platform.js';

describe('platform IPC handler', () => {
  beforeEach(() => {
    mockOn.mockClear();
    mockHandle.mockClear();
    mockGetGPUInfo.mockClear();
    mockGetGPUFeatureStatus.mockClear();
    mockIsHardwareAccelerationEnabled.mockClear();
    registerPlatformHandler();
  });

  it('returns platform, arch, test mode, and version information', () => {
    const call = mockOn.mock.calls.find((entry) => entry[0] === SyncChannels.PLATFORM);
    const listener = call?.[1];
    const event = { returnValue: undefined as unknown };

    if (!listener) {
      throw new Error('Platform listener was not registered');
    }

    listener(event);

    expect(event.returnValue).toEqual({
      platform: process.platform,
      arch: process.arch,
      isE2E: false,
      versions: {
        electron: process.versions['electron'],
        node: process.versions['node'],
        chrome: process.versions['chrome'],
      },
    });
  });

  it('returns gpu diagnostics from Electron app state', async () => {
    const call = mockHandle.mock.calls.find((entry) => entry[0] === AsyncChannels.PLATFORM_GET_GPU_DIAGNOSTICS);
    const listener = call?.[1];

    if (!listener) {
      throw new Error('GPU diagnostics listener was not registered');
    }

    await expect(listener()).resolves.toEqual({
      hardwareAccelerationEnabled: true,
      featureStatus: {
        gpu_compositing: 'enabled',
        webgl: 'enabled',
        webgpu: 'enabled',
      },
      info: {
        auxAttributes: {
          glResetNotificationStrategy: 0,
        },
        gpuDevice: [{ active: true, deviceId: 1234, vendorId: 4321 }],
      },
      infoError: null,
    });
    expect(mockIsHardwareAccelerationEnabled).toHaveBeenCalledTimes(1);
    expect(mockGetGPUFeatureStatus).toHaveBeenCalledTimes(1);
    expect(mockGetGPUInfo).toHaveBeenCalledWith('basic');
  });
});