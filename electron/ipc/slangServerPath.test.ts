import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExistsSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn((_filePath?: string) => true),
}));

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => 'C:/workspace/Pristine/dist-electron',
  },
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: (filePath: string) => mockExistsSync(filePath),
  },
  existsSync: (filePath: string) => mockExistsSync(filePath),
}));

import {
  assertSlangServerPathAvailable,
  getDevelopmentSlangServerPath,
  getPackagedSlangServerPath,
  resolveSlangServerPath,
} from './slangServerPath.js';

describe('slang server path helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves the development binary relative to the repository root', () => {
    expect(getDevelopmentSlangServerPath('C:/workspace/Pristine')).toMatch(/Pristine[\\/]binaries[\\/]slang-server\.exe$/);
    expect(getDevelopmentSlangServerPath('C:/workspace/Pristine/dist-electron')).toMatch(/Pristine[\\/]binaries[\\/]slang-server\.exe$/);
    expect(resolveSlangServerPath({ isPackaged: false, appPath: 'C:/workspace/Pristine' })).toMatch(/Pristine[\\/]binaries[\\/]slang-server\.exe$/);
    expect(resolveSlangServerPath({ isPackaged: false, appPath: 'C:/workspace/Pristine/dist-electron' })).toMatch(/Pristine[\\/]binaries[\\/]slang-server\.exe$/);
  });

  it('resolves the packaged binary relative to process.resourcesPath', () => {
    expect(getPackagedSlangServerPath('C:/Program Files/Pristine/resources')).toMatch(/resources[\\/]binaries[\\/]slang-server\.exe$/);
    expect(resolveSlangServerPath({
      isPackaged: true,
      resourcesPath: 'C:/Program Files/Pristine/resources',
    })).toMatch(/resources[\\/]binaries[\\/]slang-server\.exe$/);
  });

  it('throws a clear error when the binary is missing', () => {
    mockExistsSync.mockReturnValueOnce(false);

    expect(() => assertSlangServerPathAvailable('C:/workspace/Pristine/binaries/slang-server.exe')).toThrow(
      'Run "pnpm run prepare:slang-server" first.',
    );
  });
});