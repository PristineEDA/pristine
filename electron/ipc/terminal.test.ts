import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';

const mockHandle = vi.fn();
const send = vi.fn();

vi.mock('electron', () => ({
  ipcMain: { handle: (...args: unknown[]) => mockHandle(...args) },
  BrowserWindow: class {},
}));

const mockSpawn = vi.fn();
vi.mock('node-pty', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

import {
  disposeAllTerminalSessions,
  getTerminalLaunchConfig,
  registerTerminalHandlers,
  setTerminalProjectRoot,
} from './terminal.js';

function getHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
  const call = mockHandle.mock.calls.find((entry) => entry[0] === channel);
  if (!call) {
    throw new Error(`No handler registered for ${channel}`);
  }

  return call[1];
}

function createFakeTerminal() {
  const handlers: {
    data?: (data: string) => void;
    exit?: (event: { exitCode: number; signal: number }) => void;
  } = {};

  return {
    pid: 2468,
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    onData: vi.fn((callback: (data: string) => void) => {
      handlers.data = callback;
      return { dispose: vi.fn() };
    }),
    onExit: vi.fn((callback: (event: { exitCode: number; signal: number }) => void) => {
      handlers.exit = callback;
      return { dispose: vi.fn() };
    }),
    handlers,
  };
}

describe('terminal IPC handlers', () => {
  let mainWindow: any;
  const getMainWindow = () => mainWindow;

  beforeEach(() => {
    mockHandle.mockClear();
    mockSpawn.mockClear();
    send.mockClear();
    disposeAllTerminalSessions();
    mainWindow = {
      isDestroyed: vi.fn(() => false),
      webContents: {
        isDestroyed: vi.fn(() => false),
        send,
      },
    };
    registerTerminalHandlers(getMainWindow);
  });

  it('selects PowerShell on Windows', () => {
    expect(getTerminalLaunchConfig('win32')).toEqual({
      file: 'powershell.exe',
      args: ['-NoLogo'],
    });
  });

  it('uses the native shell on Unix-like platforms', () => {
    expect(getTerminalLaunchConfig('linux', '/bin/zsh')).toEqual({
      file: '/bin/zsh',
      args: ['-l'],
    });
  });

  it('creates a terminal session and forwards data/exit streams', async () => {
    const fakeTerminal = createFakeTerminal();
    mockSpawn.mockReturnValue(fakeTerminal);
    const root = path.resolve('sandbox-root');
    setTerminalProjectRoot(root);

    const createHandler = getHandler('async:terminal:create');
    const result = await createHandler({}, { cwd: 'src', cols: 100, rows: 40 });

    expect(result).toEqual({
      id: expect.any(String),
      pid: 2468,
      shell: expect.any(String),
    });
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        cols: 100,
        rows: 40,
        cwd: path.resolve(root, 'src'),
      }),
    );

    const sessionId = (result as { id: string }).id;
    fakeTerminal.handlers.data?.('PS> ');
    fakeTerminal.handlers.exit?.({ exitCode: 0, signal: 0 });

    expect(send).toHaveBeenNthCalledWith(1, 'stream:terminal:data', { id: sessionId, data: 'PS> ' });
    expect(send).toHaveBeenNthCalledWith(2, 'stream:terminal:exit', { id: sessionId, exitCode: 0, signal: 0 });
  });

  it('routes write, resize, and kill to the matching session', async () => {
    const fakeTerminal = createFakeTerminal();
    mockSpawn.mockReturnValue(fakeTerminal);
    const createHandler = getHandler('async:terminal:create');
    const writeHandler = getHandler('async:terminal:write');
    const resizeHandler = getHandler('async:terminal:resize');
    const killHandler = getHandler('async:terminal:kill');

    const result = await createHandler({}, {});
    const sessionId = (result as { id: string }).id;

    await expect(writeHandler({}, sessionId, 'dir\r')).resolves.toBe(true);
    await expect(resizeHandler({}, sessionId, 90, 28)).resolves.toBe(true);
    await expect(killHandler({}, sessionId)).resolves.toBe(true);

    expect(fakeTerminal.write).toHaveBeenCalledWith('dir\r');
    expect(fakeTerminal.resize).toHaveBeenCalledWith(90, 28);
    expect(fakeTerminal.kill).toHaveBeenCalled();
  });

  it('swallows resize requests for sessions that have already exited', async () => {
    const fakeTerminal = createFakeTerminal();
    fakeTerminal.resize.mockImplementation(() => {
      throw new Error('Cannot resize a pty that has already exited');
    });
    mockSpawn.mockReturnValue(fakeTerminal);

    const createHandler = getHandler('async:terminal:create');
    const resizeHandler = getHandler('async:terminal:resize');

    const result = await createHandler({}, {});
    const sessionId = (result as { id: string }).id;

    await expect(resizeHandler({}, sessionId, 90, 28)).resolves.toBe(false);
    await expect(resizeHandler({}, sessionId, 90, 28)).resolves.toBe(false);
  });

  it('kills all active sessions during shutdown cleanup', async () => {
    const firstTerminal = createFakeTerminal();
    const secondTerminal = createFakeTerminal();
    mockSpawn
      .mockReturnValueOnce(firstTerminal)
      .mockReturnValueOnce(secondTerminal);

    const createHandler = getHandler('async:terminal:create');
    await createHandler({}, {});
    await createHandler({}, {});

    disposeAllTerminalSessions();

    expect(firstTerminal.kill).toHaveBeenCalledTimes(1);
    expect(secondTerminal.kill).toHaveBeenCalledTimes(1);
  });

  it('ignores late terminal events after the window is destroyed', async () => {
    const fakeTerminal = createFakeTerminal();
    mockSpawn.mockReturnValue(fakeTerminal);

    const createHandler = getHandler('async:terminal:create');
    await createHandler({}, {});

    mainWindow.isDestroyed.mockReturnValue(true);

    expect(() => {
      fakeTerminal.handlers.data?.('late output');
      fakeTerminal.handlers.exit?.({ exitCode: 0, signal: 0 });
    }).not.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});