import { ipcMain, BrowserWindow } from 'electron';
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import * as pty from 'node-pty';
import { AsyncChannels, StreamChannels } from './channels.js';
import {
  assertNumber,
  assertOptionalString,
  assertString,
  validatePathWithinRoot,
} from './validators.js';

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;

const sessions = new Map<string, pty.IPty>();
let nextId = 1;
let projectRoot: string | null = null;

function terminateSession(session: pty.IPty): void {
  try {
    session.kill();
  } catch {
    // Ignore best-effort PTY shutdown failures.
  }

  const pid = session.pid;
  if (!pid) {
    return;
  }

  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch {
      // Process may already be gone.
    }
    return;
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Process may already be gone.
  }
}

export function disposeAllTerminalSessions(): void {
  for (const session of sessions.values()) {
    terminateSession(session);
  }

  sessions.clear();
}

export function setTerminalProjectRoot(root: string): void {
  projectRoot = root;
}

export function getTerminalLaunchConfig(
  platform: NodeJS.Platform = process.platform,
  shellFromEnv = process.env['SHELL'],
): { file: string; args: string[] } {
  if (platform === 'win32') {
    return { file: 'powershell.exe', args: ['-NoLogo'] };
  }

  const shellPath = shellFromEnv?.trim() || '/bin/bash';
  return { file: shellPath, args: ['-l'] };
}

function resolveSessionCwd(cwd?: string): string {
  if (cwd && projectRoot) {
    return validatePathWithinRoot(projectRoot, cwd);
  }

  if (cwd) {
    return path.resolve(cwd);
  }

  if (projectRoot) {
    return projectRoot;
  }

  return process.cwd();
}

function normalizeSize(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function hasSessionAlreadyExited(error: unknown): boolean {
  return error instanceof Error && /already exited/i.test(error.message);
}

function sendToMainWindow(
  getMainWindow: () => BrowserWindow | null,
  channel: string,
  payload: unknown,
): void {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) {
    return;
  }

  const contents = win.webContents;
  if (contents.isDestroyed()) {
    return;
  }

  try {
    contents.send(channel, payload);
  } catch {
    // The window may have been destroyed between the checks above and send().
  }
}

export function registerTerminalHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(AsyncChannels.TERMINAL_CREATE, async (_event, options?: unknown) => {
    const opts = (options && typeof options === 'object') ? options as Record<string, unknown> : {};
    const cwd = opts['cwd'];
    const cols = opts['cols'];
    const rows = opts['rows'];

    assertOptionalString(cwd, 'cwd');
    if (cols !== undefined) {
      assertNumber(cols, 'cols');
    }
    if (rows !== undefined) {
      assertNumber(rows, 'rows');
    }

    const launch = getTerminalLaunchConfig();
    const id = String(nextId++);
    const session = pty.spawn(launch.file, launch.args, {
      name: 'xterm-256color',
      cols: normalizeSize(cols as number | undefined, DEFAULT_COLS),
      rows: normalizeSize(rows as number | undefined, DEFAULT_ROWS),
      cwd: resolveSessionCwd(cwd),
      env: {
        ...process.env,
        TERM: 'xterm-256color',
      },
    });

    sessions.set(id, session);

    session.onData((data) => {
      sendToMainWindow(getMainWindow, StreamChannels.TERMINAL_DATA, { id, data });
    });

    session.onExit(({ exitCode, signal }) => {
      sessions.delete(id);
      sendToMainWindow(getMainWindow, StreamChannels.TERMINAL_EXIT, { id, exitCode, signal });
    });

    return {
      id,
      pid: session.pid,
      shell: path.basename(launch.file),
    };
  });

  ipcMain.handle(AsyncChannels.TERMINAL_WRITE, async (_event, id: unknown, data: unknown) => {
    assertString(id, 'id');
    assertString(data, 'data');

    const session = sessions.get(id);
    if (!session) {
      return false;
    }

    session.write(data);
    return true;
  });

  ipcMain.handle(AsyncChannels.TERMINAL_RESIZE, async (_event, id: unknown, cols: unknown, rows: unknown) => {
    assertString(id, 'id');
    assertNumber(cols, 'cols');
    assertNumber(rows, 'rows');

    const session = sessions.get(id);
    if (!session) {
      return false;
    }

    try {
      session.resize(normalizeSize(cols, DEFAULT_COLS), normalizeSize(rows, DEFAULT_ROWS));
    } catch (error) {
      if (hasSessionAlreadyExited(error)) {
        sessions.delete(id);
        return false;
      }

      throw error;
    }

    return true;
  });

  ipcMain.handle(AsyncChannels.TERMINAL_KILL, async (_event, id: unknown) => {
    assertString(id, 'id');

    const session = sessions.get(id);
    if (!session) {
      return false;
    }

    sessions.delete(id);
    terminateSession(session);
    return true;
  });
}