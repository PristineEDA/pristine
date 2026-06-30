import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsyncChannels, StreamChannels } from './channels.js';

interface MockBrowserWindow {
  isDestroyed: () => boolean;
  webContents: {
    isDestroyed: () => boolean;
    send: ReturnType<typeof vi.fn>;
  };
}

const { mockHandle, mockGetAllWindows, mockSetAppUserModelId, mockNotificationShow, mockNotificationClose } = vi.hoisted(() => ({
  mockHandle: vi.fn(),
  mockGetAllWindows: vi.fn<() => MockBrowserWindow[]>(() => []),
  mockSetAppUserModelId: vi.fn(),
  mockNotificationShow: vi.fn(),
  mockNotificationClose: vi.fn(),
}));

class NotificationMock {
  static isSupported = vi.fn(() => true);

  options: Electron.NotificationConstructorOptions;
  private listeners = new Map<string, () => void>();

  constructor(options: Electron.NotificationConstructorOptions) {
    this.options = options;
  }

  once(event: string, listener: () => void) {
    this.listeners.set(event, listener);
    return this;
  }

  show() {
    mockNotificationShow(this.options);
  }

  close() {
    mockNotificationClose(this.options);
    this.listeners.get('close')?.();
  }

  emit(event: string) {
    this.listeners.get(event)?.();
  }
}

vi.mock('electron', () => ({
  app: {
    setAppUserModelId: (...args: unknown[]) => mockSetAppUserModelId(...args),
  },
  BrowserWindow: {
    getAllWindows: () => mockGetAllWindows(),
  },
  ipcMain: {
    handle: (...args: unknown[]) => mockHandle(...args),
  },
  nativeImage: {
    createFromDataURL: (url: string) => ({ url }),
  },
  Notification: NotificationMock,
}));

vi.mock('./config.js', () => ({
  getConfigValue: vi.fn(() => 2),
}));

async function importModule() {
  vi.resetModules();
  return import('./notifications.js');
}

function getHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
  const call = mockHandle.mock.calls.find((entry) => entry[0] === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1];
}

describe('notification IPC handlers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    vi.clearAllMocks();
    mockGetAllWindows.mockReturnValue([]);
    NotificationMock.isSupported.mockReturnValue(true);
    delete process.env['PRISTINE_E2E'];
  });

  afterEach(async () => {
    const module = await import('./notifications.js');
    module.resetNotificationServiceForTests();
    vi.useRealTimers();
    delete process.env['PRISTINE_E2E'];
  });

  it('registers handlers and Windows AppUserModelID', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });

    const { registerNotificationHandlers } = await importModule();
    registerNotificationHandlers(() => null);

    expect(mockSetAppUserModelId).toHaveBeenCalledWith('com.pristine.ide');
    expect(mockHandle).toHaveBeenCalledWith(AsyncChannels.NOTIFICATIONS_PUBLISH, expect.any(Function));
    expect(mockHandle).toHaveBeenCalledWith(AsyncChannels.NOTIFICATIONS_DISMISS, expect.any(Function));
    expect(mockHandle).toHaveBeenCalledWith(AsyncChannels.NOTIFICATIONS_GET_HISTORY, expect.any(Function));

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('publishes native notifications and broadcasts history', async () => {
    const send = vi.fn();
    mockGetAllWindows.mockReturnValue([
      {
        isDestroyed: () => false,
        webContents: {
          isDestroyed: () => false,
          send,
        },
      },
    ]);

    const { registerNotificationHandlers } = await importModule();
    registerNotificationHandlers(() => null);

    const handler = getHandler(AsyncChannels.NOTIFICATIONS_PUBLISH);
    const record = await handler({}, { level: 'warning', title: 'Warn', body: 'Timing drift' });

    expect(record).toMatchObject({
      body: 'Timing drift',
      createdAt: 10_000,
      expiresAt: 12_000,
      level: 'warning',
      title: 'Warn',
    });
    expect(mockNotificationShow).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Timing drift',
      title: 'Warn',
    }));
    expect(send).toHaveBeenCalledWith(StreamChannels.NOTIFICATIONS_HISTORY_CHANGED, [record]);

    vi.advanceTimersByTime(2_000);
    expect(mockNotificationClose).toHaveBeenCalled();
  });

  it('keeps history when native notifications are unsupported or skipped for e2e', async () => {
    process.env['PRISTINE_E2E'] = '1';

    const { registerNotificationHandlers } = await importModule();
    registerNotificationHandlers(() => null);

    const publish = getHandler(AsyncChannels.NOTIFICATIONS_PUBLISH);
    const getHistory = getHandler(AsyncChannels.NOTIFICATIONS_GET_HISTORY);

    const record = await publish({}, { level: 'info', title: 'Info' });

    expect(mockNotificationShow).not.toHaveBeenCalled();
    await expect(getHistory({})).resolves.toEqual([record]);
  });

  it('dismisses notifications from history and closes native instances', async () => {
    const { registerNotificationHandlers } = await importModule();
    registerNotificationHandlers(() => null);

    const publish = getHandler(AsyncChannels.NOTIFICATIONS_PUBLISH);
    const dismiss = getHandler(AsyncChannels.NOTIFICATIONS_DISMISS);
    const getHistory = getHandler(AsyncChannels.NOTIFICATIONS_GET_HISTORY);

    const record = await publish({}, { level: 'error', title: 'Error' });
    await dismiss({}, (record as { id: string }).id);

    expect(mockNotificationClose).toHaveBeenCalled();
    await expect(getHistory({})).resolves.toEqual([]);
  });
});
