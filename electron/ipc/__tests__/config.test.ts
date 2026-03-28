import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsyncChannels, SyncChannels } from '../channels.js';

const { mockOn, mockHandle, mockFs, mockGetPath } = vi.hoisted(() => ({
  mockOn: vi.fn(),
  mockHandle: vi.fn(),
  mockFs: {
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
  mockGetPath: vi.fn((_name: string) => '/tmp/pristine-user-data'),
}));

vi.mock('electron', () => ({
  ipcMain: {
    on: (...args: unknown[]) => mockOn(...args),
    handle: (...args: unknown[]) => mockHandle(...args),
  },
  app: {
    getPath: (name: string) => mockGetPath(name),
  },
}));

vi.mock('node:fs', () => ({
  default: mockFs,
}));

async function importModule() {
  vi.resetModules();
  return import('../config.js');
}

function getSyncListener(channel: string): (...args: unknown[]) => void {
  const call = mockOn.mock.calls.find((entry) => entry[0] === channel);
  if (!call) throw new Error(`No sync listener registered for ${channel}`);
  return call[1];
}

function getAsyncHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
  const call = mockHandle.mock.calls.find((entry) => entry[0] === channel);
  if (!call) throw new Error(`No async handler registered for ${channel}`);
  return call[1];
}

describe('config IPC handlers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockOn.mockClear();
    mockHandle.mockClear();
    mockGetPath.mockReturnValue('/tmp/pristine-user-data');
    mockFs.readFileSync.mockReset();
    mockFs.mkdirSync.mockReset();
    mockFs.writeFileSync.mockReset();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('returns null for missing config keys when no config file exists', async () => {
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const { registerConfigHandlers } = await importModule();
    registerConfigHandlers();

    const listener = getSyncListener(SyncChannels.CONFIG_GET);
    const event = { returnValue: undefined as unknown };
    listener(event, 'theme');

    expect(event.returnValue).toBeNull();
  });

  it('loads existing config values from disk', async () => {
    mockFs.readFileSync.mockReturnValue('{"theme":"dracula"}');

    const { registerConfigHandlers } = await importModule();
    registerConfigHandlers();

    const listener = getSyncListener(SyncChannels.CONFIG_GET);
    const event = { returnValue: undefined as unknown };
    listener(event, 'theme');

    expect(event.returnValue).toBe('dracula');
  });

  it('writes config changes after the debounce interval', async () => {
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const { registerConfigHandlers } = await importModule();
    registerConfigHandlers();

    const handler = getAsyncHandler(AsyncChannels.CONFIG_SET);
    await handler({}, 'theme', 'dracula');

    expect(mockFs.writeFileSync).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    const configFile = path.join('/tmp/pristine-user-data', 'config.json');

    expect(mockFs.mkdirSync).toHaveBeenCalledWith(path.dirname(configFile), { recursive: true });
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      configFile,
      JSON.stringify({ theme: 'dracula' }, null, 2),
      'utf-8',
    );
  });

  it('validates config keys before saving', async () => {
    mockFs.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const { registerConfigHandlers } = await importModule();
    registerConfigHandlers();

    const handler = getAsyncHandler(AsyncChannels.CONFIG_SET);
    await expect(handler({}, 42, 'dracula')).rejects.toThrow('Expected string');
  });
});