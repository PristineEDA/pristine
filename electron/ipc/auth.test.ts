import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsyncChannels, StreamChannels } from './channels.js';

const {
  mockGetAllWindows,
  mockGetConfigSnapshot,
  mockGetPath,
  mockHandle,
  mockFs,
  mockIsReady,
  mockNetFetch,
  mockSetConfigValues,
  mockShellOpenExternal,
  registerConfigChangeListener,
  resetConfigChangeListeners,
} = vi.hoisted(() => {
  const configChangeListeners: Array<(key: string) => void> = [];

  return {
    mockGetAllWindows: vi.fn<() => Array<{
      isDestroyed: () => boolean;
      webContents: {
        isDestroyed: () => boolean;
        send: (...args: unknown[]) => void;
      };
    }>>(() => []),
    mockGetConfigSnapshot: vi.fn(() => ({})),
    mockGetPath: vi.fn((_name: string) => '/tmp/pristine-user-data'),
    mockHandle: vi.fn(),
    mockFs: {
      mkdirSync: vi.fn(),
      readFileSync: vi.fn(),
      unlinkSync: vi.fn(),
      writeFileSync: vi.fn(),
    },
    mockIsReady: vi.fn(() => true),
    mockNetFetch: vi.fn(),
    mockSetConfigValues: vi.fn(),
    mockShellOpenExternal: vi.fn(),
    registerConfigChangeListener: (listener: (key: string) => void) => {
      configChangeListeners.push(listener);
    },
    resetConfigChangeListeners: () => {
      configChangeListeners.length = 0;
    },
  };
});

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => mockGetAllWindows(),
  },
  ipcMain: {
    handle: (...args: unknown[]) => mockHandle(...args),
  },
  app: {
    getPath: (name: string) => mockGetPath(name),
    isReady: () => mockIsReady(),
  },
  net: {
    fetch: (...args: unknown[]) => mockNetFetch(...args),
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value, 'utf-8'),
    decryptString: (value: Buffer) => value.toString('utf-8'),
  },
  shell: {
    openExternal: (...args: unknown[]) => mockShellOpenExternal(...args),
  },
}));

vi.mock('node:fs', () => ({
  default: mockFs,
}));

vi.mock('./config.js', () => ({
  getConfigSnapshot: () => mockGetConfigSnapshot(),
  onConfigValueChanged: (listener: (key: string) => void) => registerConfigChangeListener(listener),
  setConfigValues: (...args: unknown[]) => mockSetConfigValues(...args),
}));

interface TestStoredAuthSession {
  accessToken: string;
  profile: {
    avatarUrl: string | null;
    email: string;
    sessionExpiresAt: number | null;
    syncedAt: string | null;
    userId: string;
    username: string;
  };
  refreshToken: string;
}

type TestStoredSessionOverrides = Partial<Omit<TestStoredAuthSession, 'profile'>> & {
  profile?: Partial<TestStoredAuthSession['profile']>;
};

function createStoredSession(overrides: TestStoredSessionOverrides = {}): TestStoredAuthSession {
  const baseSession: TestStoredAuthSession = {
    accessToken: 'seed-access-token',
    profile: {
      avatarUrl: null,
      email: 'alice@example.com',
      sessionExpiresAt: 1_900_000_000,
      syncedAt: null,
      userId: 'user-1',
      username: 'Alice',
    },
    refreshToken: 'seed-refresh-token',
  };

  return {
    ...baseSession,
    ...overrides,
    profile: {
      ...baseSession.profile,
      ...overrides.profile,
    },
  };
}

function encodeStoredSession(session: TestStoredAuthSession): string {
  return JSON.stringify({
    encrypted: false,
    payload: Buffer.from(JSON.stringify(session), 'utf-8').toString('base64'),
  });
}

function decodeStoredSessionEnvelope(rawEnvelope: string): TestStoredAuthSession {
  const envelope = JSON.parse(rawEnvelope) as { encrypted: boolean; payload: string };
  return JSON.parse(Buffer.from(envelope.payload, 'base64').toString('utf-8')) as TestStoredAuthSession;
}

function toPublicSession(session: TestStoredAuthSession) {
  return {
    avatarUrl: session.profile.avatarUrl,
    email: session.profile.email,
    syncedAt: session.profile.syncedAt,
    userId: session.profile.userId,
    username: session.profile.username,
  };
}

function createResponse(body: Record<string, unknown>, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function getAsyncHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
  const call = mockHandle.mock.calls.find((entry) => entry[0] === channel);
  if (!call) {
    throw new Error(`No async handler registered for ${channel}`);
  }

  return call[1];
}

function createWindowSendSpy() {
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

  return send;
}

async function importModule() {
  vi.resetModules();
  return import('./auth.js');
}

describe('auth IPC handlers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-21T00:00:00.000Z'));
    mockGetAllWindows.mockReset();
    mockGetAllWindows.mockReturnValue([]);
    mockGetConfigSnapshot.mockReset();
    mockGetConfigSnapshot.mockReturnValue({});
    mockGetPath.mockReset();
    mockGetPath.mockReturnValue('/tmp/pristine-user-data');
    mockHandle.mockClear();
    mockFs.mkdirSync.mockReset();
    mockFs.readFileSync.mockReset();
    mockFs.unlinkSync.mockReset();
    mockFs.writeFileSync.mockReset();
    mockIsReady.mockReset();
    mockIsReady.mockReturnValue(true);
    mockNetFetch.mockReset();
    mockSetConfigValues.mockReset();
    mockShellOpenExternal.mockReset();
    resetConfigChangeListeners();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('returns the cached desktop session immediately and defers validation for fresh sessions', async () => {
    const cachedSession = createStoredSession({
      profile: {
        sessionExpiresAt: 1_900_003_600,
      },
    });
    const send = createWindowSendSpy();
    mockFs.readFileSync.mockReturnValue(encodeStoredSession(cachedSession));
    mockNetFetch.mockResolvedValueOnce(createResponse({
      access_token: 'next-access-token',
      expires_at: 2_000_000_000,
      refresh_token: 'next-refresh-token',
    }));

    const { registerAuthHandlers } = await importModule();
    registerAuthHandlers();

    const getSession = getAsyncHandler(AsyncChannels.AUTH_GET_SESSION);
    await expect(getSession({})).resolves.toEqual(toPublicSession(cachedSession));
    expect(mockNetFetch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(14 * 60_000);

    expect(mockNetFetch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockNetFetch).toHaveBeenCalledTimes(1);
    expect(mockNetFetch).toHaveBeenCalledWith(
      'https://fsuyziugqxslwkaxcakv.supabase.co/auth/v1/token?grant_type=refresh_token',
      expect.objectContaining({
        body: JSON.stringify({ refresh_token: 'seed-refresh-token' }),
        method: 'POST',
      }),
    );

    const persistedSession = decodeStoredSessionEnvelope(mockFs.writeFileSync.mock.calls.at(-1)?.[1] as string);
    expect(persistedSession.accessToken).toBe('next-access-token');
    expect(persistedSession.refreshToken).toBe('next-refresh-token');
    expect(persistedSession.profile.sessionExpiresAt).toBe(2_000_000_000);
    expect(send).not.toHaveBeenCalled();
  });

  it('waits briefly before refreshing expired sessions to avoid startup hot loops', async () => {
    const cachedSession = createStoredSession({
      profile: {
        sessionExpiresAt: 1_600_000_000,
      },
    });
    const send = createWindowSendSpy();
    mockFs.readFileSync.mockReturnValue(encodeStoredSession(cachedSession));
    mockNetFetch.mockResolvedValueOnce(createResponse({
      access_token: 'next-access-token',
      expires_at: 2_000_000_000,
      refresh_token: 'next-refresh-token',
    }));

    const { registerAuthHandlers } = await importModule();
    registerAuthHandlers();

    const getSession = getAsyncHandler(AsyncChannels.AUTH_GET_SESSION);
    await expect(getSession({})).resolves.toEqual(toPublicSession(cachedSession));

    await vi.advanceTimersByTimeAsync(4_999);

    expect(mockNetFetch).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(mockNetFetch).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps the cached session and retries automatically after a transient refresh failure', async () => {
    const cachedSession = createStoredSession({
      profile: {
        sessionExpiresAt: 1_600_000_000,
      },
    });
    const send = createWindowSendSpy();
    mockFs.readFileSync.mockReturnValue(encodeStoredSession(cachedSession));
    mockNetFetch
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(createResponse({
        access_token: 'retry-access-token',
        expires_at: 2_100_000_000,
        refresh_token: 'retry-refresh-token',
      }));

    const { registerAuthHandlers } = await importModule();
    registerAuthHandlers();

    const getSession = getAsyncHandler(AsyncChannels.AUTH_GET_SESSION);
    await expect(getSession({})).resolves.toEqual(toPublicSession(cachedSession));

    await vi.advanceTimersByTimeAsync(5_000);

    expect(mockNetFetch).toHaveBeenCalledTimes(1);
    expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalledWith(StreamChannels.AUTH_STATE_CHANGED, null);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(mockNetFetch).toHaveBeenCalledTimes(2);
    const persistedSession = decodeStoredSessionEnvelope(mockFs.writeFileSync.mock.calls.at(-1)?.[1] as string);
    expect(persistedSession.accessToken).toBe('retry-access-token');
    expect(persistedSession.refreshToken).toBe('retry-refresh-token');
    expect(send).not.toHaveBeenCalled();
  });

  it('clears the cached session when the refresh token is terminally invalid', async () => {
    const cachedSession = createStoredSession({
      profile: {
        sessionExpiresAt: 1_600_000_000,
      },
    });
    const send = createWindowSendSpy();
    mockFs.readFileSync.mockReturnValue(encodeStoredSession(cachedSession));
    mockNetFetch.mockResolvedValueOnce(createResponse({
      message: 'Invalid Refresh Token',
    }, 400));

    const { registerAuthHandlers } = await importModule();
    registerAuthHandlers();

    const getSession = getAsyncHandler(AsyncChannels.AUTH_GET_SESSION);
    await expect(getSession({})).resolves.toEqual(toPublicSession(cachedSession));

    await vi.advanceTimersByTimeAsync(5_000);

    expect(mockFs.unlinkSync).toHaveBeenCalledWith(path.join('/tmp/pristine-user-data', 'auth-session.json'));
    expect(send).toHaveBeenCalledWith(StreamChannels.AUTH_STATE_CHANGED, null);
    expect(send).toHaveBeenCalledWith(StreamChannels.AUTH_ERROR, 'Invalid Refresh Token');
    await expect(getSession({})).resolves.toBeNull();
  });

  it('always clears the local desktop session on explicit sign out', async () => {
    const cachedSession = createStoredSession({
      profile: {
        sessionExpiresAt: 1_600_000_000,
      },
    });
    const send = createWindowSendSpy();
    mockFs.readFileSync.mockReturnValue(encodeStoredSession(cachedSession));
    mockNetFetch.mockRejectedValueOnce(new Error('offline'));

    const { registerAuthHandlers } = await importModule();
    registerAuthHandlers();

    const signOut = getAsyncHandler(AsyncChannels.AUTH_SIGN_OUT);
    await expect(signOut({})).resolves.toBe(true);

    expect(mockFs.unlinkSync).toHaveBeenCalledWith(path.join('/tmp/pristine-user-data', 'auth-session.json'));
    expect(send).toHaveBeenCalledWith(StreamChannels.AUTH_STATE_CHANGED, null);
  });
});
