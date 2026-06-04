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
  assertPristineEnginePathAvailable,
  getDevelopmentPristineEnginePath,
  getPackagedPristineEnginePath,
  getPristineEngineBinaryName,
  resolvePristineEnginePath,
} from './pristineEnginePath.js';

describe('pristine-engine path helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { platform: 'win32', binaryName: 'pristine-engine.exe' },
    { platform: 'linux', binaryName: 'pristine-engine' },
    { platform: 'darwin', binaryName: 'pristine-engine' },
  ] as const)('resolves the development binary relative to the repository root on $platform', ({ platform, binaryName }) => {
    const binaryPattern = new RegExp(`Pristine[\\\\/]binaries[\\\\/]${binaryName.replace('.', '\\.')}$`);

    expect(getPristineEngineBinaryName(platform)).toBe(binaryName);
    expect(getDevelopmentPristineEnginePath('C:/workspace/Pristine', platform)).toMatch(binaryPattern);
    expect(getDevelopmentPristineEnginePath('C:/workspace/Pristine/dist-electron', platform)).toMatch(binaryPattern);
    expect(resolvePristineEnginePath({ isPackaged: false, appPath: 'C:/workspace/Pristine', platform })).toMatch(binaryPattern);
    expect(resolvePristineEnginePath({ isPackaged: false, appPath: 'C:/workspace/Pristine/dist-electron', platform })).toMatch(binaryPattern);
  });

  it('resolves the packaged binary relative to process.resourcesPath', () => {
    const expectedBinaryName = getPristineEngineBinaryName();
    const binaryPattern = new RegExp(`resources[\\\\/]binaries[\\\\/]${expectedBinaryName.replace('.', '\\.')}$`);

    expect(getPackagedPristineEnginePath('C:/Program Files/Pristine/resources')).toMatch(binaryPattern);
    expect(resolvePristineEnginePath({
      isPackaged: true,
      resourcesPath: 'C:/Program Files/Pristine/resources',
    })).toMatch(binaryPattern);
  });

  it('throws a clear error when the binary is missing', () => {
    mockExistsSync.mockReturnValueOnce(false);

    expect(() => assertPristineEnginePathAvailable(`C:/workspace/Pristine/binaries/${getPristineEngineBinaryName()}`)).toThrow(
      'Run "pnpm run prepare:pristine-engine" first.',
    );
  });
});
