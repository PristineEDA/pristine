import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExposeInMainWorld, mockSendSync, mockInvoke, mockOn, mockRemoveListener } = vi.hoisted(() => ({
  mockExposeInMainWorld: vi.fn(),
  mockSendSync: vi.fn((channel: string, ...args: unknown[]) => {
    if (channel === 'sync:window:is-maximized') {
      return true;
    }
    if (channel === 'sync:config:get') {
      return args[0] === 'theme' ? 'dracula' : null;
    }
    return null;
  }),
  mockInvoke: vi.fn(),
  mockOn: vi.fn(),
  mockRemoveListener: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, api: unknown) => mockExposeInMainWorld(name, api),
  },
  ipcRenderer: {
    sendSync: (channel: string, ...args: unknown[]) => mockSendSync(channel, ...args),
    invoke: (channel: string, ...args: unknown[]) => mockInvoke(channel, ...args),
    on: (channel: string, listener: (...args: unknown[]) => void) => mockOn(channel, listener),
    removeListener: (channel: string, listener: (...args: unknown[]) => void) =>
      mockRemoveListener(channel, listener),
  },
}));

async function importPreload() {
  vi.resetModules();
  await import('./preload.ts');
}

describe('preload bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes a typed electronAPI bridge in the renderer world', async () => {
    await importPreload();

    expect(mockExposeInMainWorld).toHaveBeenCalledTimes(1);
    const [, api] = mockExposeInMainWorld.mock.calls[0];

    expect(mockSendSync).not.toHaveBeenCalledWith('sync:platform');
    expect(api.platform).toBe(process.platform);
    expect(api.arch).toBe(process.arch);
    expect(api.versions.electron).toBe(process.versions.electron);
    expect(api.isMaximized()).toBe(true);
    expect(api.config.get('theme')).toBe('dracula');
  });

  it('forwards async invocations and stream subscriptions through ipcRenderer', async () => {
    await importPreload();

    const [, api] = mockExposeInMainWorld.mock.calls[0];
    const onMaximizedChange = vi.fn();

    api.minimize();
    api.maximize();
    api.show();
    api.hide();
    api.close();
    api.setFloatingInfoWindowVisible(true);
    api.fs.readFile('src/main.v', 'utf-8');
    api.shell.exec('make', ['lint'], { cwd: 'rtl' });

    const dispose = api.onMaximizedChange(onMaximizedChange);

    expect(mockInvoke).toHaveBeenCalledWith('async:window:minimize');
    expect(mockInvoke).toHaveBeenCalledWith('async:window:maximize');
    expect(mockInvoke).toHaveBeenCalledWith('async:window:show');
    expect(mockInvoke).toHaveBeenCalledWith('async:window:hide');
    expect(mockInvoke).toHaveBeenCalledWith('async:window:close');
    expect(mockInvoke).toHaveBeenCalledWith('async:window:set-floating-info-visibility', true);
    expect(mockInvoke).toHaveBeenCalledWith('async:fs:read-file', 'src/main.v', 'utf-8');
    expect(mockInvoke).toHaveBeenCalledWith('async:shell:exec', 'make', ['lint'], { cwd: 'rtl' });
    expect(mockOn).toHaveBeenCalledWith('stream:window:maximized-change', expect.any(Function));

    const handler = mockOn.mock.calls.find((call) => call[0] === 'stream:window:maximized-change')?.[1];
    handler({}, true);
    expect(onMaximizedChange).toHaveBeenCalledWith(true);

    dispose();
    expect(mockRemoveListener).toHaveBeenCalledWith('stream:window:maximized-change', handler);
  });
});