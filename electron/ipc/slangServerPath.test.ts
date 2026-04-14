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
  getSlangServerBinaryName,
  resolveSlangServerPath,
} from './slangServerPath.js';

describe('slang server path helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { platform: 'win32', binaryName: 'slang-server.exe' },
    { platform: 'linux', binaryName: 'slang-server' },
    { platform: 'darwin', binaryName: 'slang-server' },
  ] as const)('resolves the development binary relative to the repository root on $platform', ({ platform, binaryName }) => {
    const binaryPattern = new RegExp(`Pristine[\\\\/]binaries[\\\\/]${binaryName.replace('.', '\\.')}$`);

    expect(getSlangServerBinaryName(platform)).toBe(binaryName);
    expect(getDevelopmentSlangServerPath('C:/workspace/Pristine', platform)).toMatch(binaryPattern);
    expect(getDevelopmentSlangServerPath('C:/workspace/Pristine/dist-electron', platform)).toMatch(binaryPattern);
    expect(resolveSlangServerPath({ isPackaged: false, appPath: 'C:/workspace/Pristine', platform })).toMatch(binaryPattern);
    expect(resolveSlangServerPath({ isPackaged: false, appPath: 'C:/workspace/Pristine/dist-electron', platform })).toMatch(binaryPattern);
  });

  it('resolves the packaged binary relative to process.resourcesPath', () => {
    const expectedBinaryName = getSlangServerBinaryName();
    const binaryPattern = new RegExp(`resources[\\\\/]binaries[\\\\/]${expectedBinaryName.replace('.', '\\.')}$`);

    expect(getPackagedSlangServerPath('C:/Program Files/Pristine/resources')).toMatch(binaryPattern);
    expect(resolveSlangServerPath({
      isPackaged: true,
      resourcesPath: 'C:/Program Files/Pristine/resources',
    })).toMatch(binaryPattern);
  });

  it('throws a clear error when the binary is missing', () => {
    mockExistsSync.mockReturnValueOnce(false);

    expect(() => assertSlangServerPathAvailable(`C:/workspace/Pristine/binaries/${getSlangServerBinaryName()}`)).toThrow(
      'Run "pnpm run prepare:slang-server" first.',
    );
  });
});
