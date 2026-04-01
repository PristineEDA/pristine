import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncChannels } from './channels.js';

const mockOn = vi.fn();

vi.mock('electron', () => ({
  ipcMain: {
    on: (...args: unknown[]) => mockOn(...args),
  },
}));

import { registerPlatformHandler } from './platform.js';

describe('platform IPC handler', () => {
  beforeEach(() => {
    mockOn.mockClear();
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
});