import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ElectronAPI } from '../../../../../types/electron-api';
import {
  ensureTerminalSession,
  getTerminalSessionSnapshot,
  resetTerminalSessionStoreForTests,
  subscribeTerminalSession,
  terminateTerminalSession,
  writeTerminalSession,
} from './terminalSessionStore';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('terminalSessionStore', () => {
  beforeEach(() => {
    resetTerminalSessionStoreForTests();
  });

  it('deduplicates concurrent session creation and updates the snapshot once ready', async () => {
    const createRequest = deferred<{ id: string; pid: number; shell: string }>();
    let onDataCallback: ((payload: { id: string; data: string }) => void) | undefined;
    let onExitCallback: ((payload: { id: string; exitCode: number; signal: number }) => void) | undefined;
    const baseApi = window.electronAPI as ElectronAPI;
    const createMock = vi.fn(() => createRequest.promise);

    window.electronAPI = {
      ...baseApi,
      terminal: {
        ...baseApi.terminal,
        create: createMock,
        onData: vi.fn((callback: (payload: { id: string; data: string }) => void) => {
          onDataCallback = callback;
          return vi.fn();
        }),
        onExit: vi.fn((callback: (payload: { id: string; exitCode: number; signal: number }) => void) => {
          onExitCallback = callback;
          return vi.fn();
        }),
      },
    };

    const first = ensureTerminalSession({ cols: 100, rows: 30 });
    const second = ensureTerminalSession({ cols: 100, rows: 30 });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(getTerminalSessionSnapshot().isStarting).toBe(true);

    createRequest.resolve({ id: 'term-1', pid: 501, shell: 'powershell.exe' });
    await Promise.all([first, second]);

    expect(getTerminalSessionSnapshot()).toMatchObject({
      sessionId: 'term-1',
      pid: 501,
      shellLabel: 'powershell.exe',
      isStarting: false,
      error: null,
    });
    expect(onDataCallback).toBeTypeOf('function');
    expect(onExitCallback).toBeTypeOf('function');
  });

  it('appends matching terminal data, ignores unrelated sessions, and clears state on exit', async () => {
    let onDataCallback: ((payload: { id: string; data: string }) => void) | undefined;
    let onExitCallback: ((payload: { id: string; exitCode: number; signal: number }) => void) | undefined;
    const baseApi = window.electronAPI as ElectronAPI;

    window.electronAPI = {
      ...baseApi,
      terminal: {
        ...baseApi.terminal,
        create: vi.fn().mockResolvedValue({ id: 'term-2', pid: 601, shell: 'bash' }),
        onData: vi.fn((callback: (payload: { id: string; data: string }) => void) => {
          onDataCallback = callback;
          return vi.fn();
        }),
        onExit: vi.fn((callback: (payload: { id: string; exitCode: number; signal: number }) => void) => {
          onExitCallback = callback;
          return vi.fn();
        }),
      },
    };

    const listener = vi.fn();
    const unsubscribe = subscribeTerminalSession(listener);

    await ensureTerminalSession();
    onDataCallback?.({ id: 'other-session', data: 'ignored\r\n' });
    onDataCallback?.({ id: 'term-2', data: 'hello\r\n' });

    expect(getTerminalSessionSnapshot().buffer).toBe('hello\r\n');

    onExitCallback?.({ id: 'term-2', exitCode: 7, signal: 0 });

    expect(getTerminalSessionSnapshot()).toMatchObject({
      sessionId: null,
      pid: null,
      isStarting: false,
    });
    expect(getTerminalSessionSnapshot().buffer).toContain('[bash exited with code 7]');
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  it('waits for a pending create before terminating the session', async () => {
    const createRequest = deferred<{ id: string; pid: number; shell: string }>();
    const killMock = vi.fn().mockResolvedValue(true);
    const baseApi = window.electronAPI as ElectronAPI;

    window.electronAPI = {
      ...baseApi,
      terminal: {
        ...baseApi.terminal,
        create: vi.fn(() => createRequest.promise),
        kill: killMock,
        onData: vi.fn(() => vi.fn()),
        onExit: vi.fn(() => vi.fn()),
      },
    };

    const creating = ensureTerminalSession();
    const terminating = terminateTerminalSession();

    createRequest.resolve({ id: 'term-3', pid: 701, shell: 'zsh' });

    await Promise.all([creating, terminating]);

    expect(killMock).toHaveBeenCalledWith('term-3');
    expect(getTerminalSessionSnapshot()).toMatchObject({
      buffer: '',
      error: null,
      isStarting: false,
      pid: null,
      sessionId: null,
      shellLabel: 'shell',
    });
  });

  it('reports when the terminal backend is unavailable and blocks writes', async () => {
    const baseApi = window.electronAPI as ElectronAPI;

    window.electronAPI = {
      ...baseApi,
      terminal: undefined as never,
    };

    await ensureTerminalSession();

    expect(getTerminalSessionSnapshot()).toMatchObject({
      error: 'Terminal backend is unavailable.',
      isStarting: false,
      sessionId: null,
    });
    await expect(writeTerminalSession('dir\r')).resolves.toBe(false);
  });
});