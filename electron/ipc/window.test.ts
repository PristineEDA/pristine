import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AsyncChannels, StreamChannels, SyncChannels } from './channels.js';

const { mockOn, mockHandle } = vi.hoisted(() => ({
  mockOn: vi.fn(),
  mockHandle: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    on: (...args: unknown[]) => mockOn(...args),
    handle: (...args: unknown[]) => mockHandle(...args),
  },
  BrowserWindow: class {},
}));

import { registerWindowHandlers, setupWindowStreams } from './window.js';

function getOnListener(channel: string): (...args: unknown[]) => void {
  const call = mockOn.mock.calls.find((entry) => entry[0] === channel);
  if (!call) throw new Error(`No sync listener registered for ${channel}`);
  return call[1];
}

function getHandleListener(channel: string): (...args: unknown[]) => Promise<unknown> | unknown {
  const call = mockHandle.mock.calls.find((entry) => entry[0] === channel);
  if (!call) throw new Error(`No async handler registered for ${channel}`);
  return call[1];
}

describe('window IPC handlers', () => {
  beforeEach(() => {
    mockOn.mockClear();
    mockHandle.mockClear();
  });

  it('returns maximized state via sync channel', () => {
    const event = { returnValue: undefined as boolean | undefined };
    const getMainWindow = () => ({ isMaximized: () => true }) as any;

    registerWindowHandlers(getMainWindow);
    const listener = getOnListener(SyncChannels.WINDOW_IS_MAXIMIZED);
    listener(event);

    expect(event.returnValue).toBe(true);
  });

  it('returns false when minimizing without a window', async () => {
    registerWindowHandlers(() => null);
    const handler = getHandleListener(AsyncChannels.WINDOW_MINIMIZE);

    expect(handler({})).toBe(false);
  });

  it('toggles maximize state and closes the window', async () => {
    let maximized = false;
    const win = {
      minimize: vi.fn(),
      maximize: vi.fn(() => { maximized = true; }),
      unmaximize: vi.fn(() => { maximized = false; }),
      isMaximized: vi.fn(() => maximized),
      close: vi.fn(),
    };

    registerWindowHandlers(() => win as any);

    const minimize = getHandleListener(AsyncChannels.WINDOW_MINIMIZE);
    const maximize = getHandleListener(AsyncChannels.WINDOW_MAXIMIZE);
    const close = getHandleListener(AsyncChannels.WINDOW_CLOSE);

    expect(minimize({})).toBe(true);
    expect(maximize({})).toBe(true);
    expect(maximize({})).toBe(false);
    expect(close({})).toBe(true);

    expect(win.minimize).toHaveBeenCalledTimes(1);
    expect(win.maximize).toHaveBeenCalledTimes(1);
    expect(win.unmaximize).toHaveBeenCalledTimes(1);
    expect(win.close).toHaveBeenCalledTimes(1);
  });

  it('emits maximize and unmaximize stream events', () => {
    const events: Record<string, () => void> = {};
    const send = vi.fn();
    const win = {
      on: vi.fn((event: string, callback: () => void) => {
        events[event] = callback;
      }),
      webContents: { send },
    };

    setupWindowStreams(win as any);
    events['maximize']();
    events['unmaximize']();

    expect(send).toHaveBeenNthCalledWith(1, StreamChannels.WINDOW_MAXIMIZED_CHANGE, true);
    expect(send).toHaveBeenNthCalledWith(2, StreamChannels.WINDOW_MAXIMIZED_CHANGE, false);
  });
});