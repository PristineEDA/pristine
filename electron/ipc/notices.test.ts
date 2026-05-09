import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockHandle,
  mockShowItemInFolder,
  mockAccess,
  mockAppState,
} = vi.hoisted(() => ({
  mockHandle: vi.fn(),
  mockShowItemInFolder: vi.fn(),
  mockAccess: vi.fn(),
  mockAppState: {
    appPath: 'C:/Users/maksy/Desktop/project/pristine',
    isPackaged: false,
  },
}));

vi.mock('electron', () => ({
  app: {
    getAppPath: () => mockAppState.appPath,
    get isPackaged() {
      return mockAppState.isPackaged;
    },
  },
  ipcMain: {
    handle: (...args: unknown[]) => mockHandle(...args),
  },
  shell: {
    showItemInFolder: (...args: unknown[]) => mockShowItemInFolder(...args),
  },
}));

vi.mock('node:fs/promises', () => ({
  access: (...args: unknown[]) => mockAccess(...args),
}));

import { getBundledNoticeFilePath, registerNoticeHandlers, revealBundledNoticeFiles } from './notices.js';

function getHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
  const call = mockHandle.mock.calls.find((entry) => entry[0] === channel);
  if (!call) {
    throw new Error(`No handler registered for ${channel}`);
  }

  return call[1];
}

describe('notice IPC handlers', () => {
  const originalResourcesPath = process.resourcesPath;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAppState.isPackaged = false;
    mockAppState.appPath = 'C:/Users/maksy/Desktop/project/pristine';
    Object.defineProperty(process, 'resourcesPath', {
      configurable: true,
      value: 'C:/Program Files/Pristine/resources',
    });
  });

  afterAll(() => {
    Object.defineProperty(process, 'resourcesPath', {
      configurable: true,
      value: originalResourcesPath,
    });
  });

  it('resolves the root NOTICE file in development', () => {
    expect(getBundledNoticeFilePath()).toBe(path.join('C:/Users/maksy/Desktop/project/pristine', 'NOTICE'));
  });

  it('resolves the packaged NOTICE file from the resources licenses directory', () => {
    mockAppState.isPackaged = true;

    expect(getBundledNoticeFilePath()).toBe(path.join('C:/Program Files/Pristine/resources', 'licenses', 'NOTICE'));
  });

  it('reveals the bundled notice file when it exists', async () => {
    mockAccess.mockResolvedValue(undefined);

    await expect(revealBundledNoticeFiles()).resolves.toBe(true);
    expect(mockShowItemInFolder).toHaveBeenCalledWith(path.join('C:/Users/maksy/Desktop/project/pristine', 'NOTICE'));
  });

  it('returns false when the bundled notice file is unavailable', async () => {
    mockAccess.mockRejectedValue(new Error('missing'));

    await expect(revealBundledNoticeFiles()).resolves.toBe(false);
    expect(mockShowItemInFolder).not.toHaveBeenCalled();
  });

  it('registers the bundled notice reveal handler', async () => {
    mockAccess.mockResolvedValue(undefined);
    registerNoticeHandlers();

    const handler = getHandler('async:notices:reveal-bundled-files');

    await expect(handler({})).resolves.toBe(true);
    expect(mockShowItemInFolder).toHaveBeenCalledWith(path.join('C:/Users/maksy/Desktop/project/pristine', 'NOTICE'));
  });
});