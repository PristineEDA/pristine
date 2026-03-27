import { ipcMain, BrowserWindow } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { AsyncChannels, StreamChannels } from './channels.js';
import { assertString } from './validators.js';

const processes = new Map<string, ChildProcess>();
let nextId = 1;

export function registerShellHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(
    AsyncChannels.SHELL_EXEC,
    async (_event, command: unknown, args?: unknown, options?: unknown) => {
      assertString(command, 'command');
      const argList = Array.isArray(args) ? args.map(String) : [];
      const opts = (options && typeof options === 'object') ? options as Record<string, unknown> : {};
      const cwd = typeof opts['cwd'] === 'string' ? opts['cwd'] : undefined;

      const id = String(nextId++);
      const child = spawn(command, argList, {
        cwd,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      processes.set(id, child);

      const win = getMainWindow();

      child.stdout?.on('data', (data: Buffer) => {
        win?.webContents.send(StreamChannels.SHELL_STDOUT, { id, data: data.toString() });
      });

      child.stderr?.on('data', (data: Buffer) => {
        win?.webContents.send(StreamChannels.SHELL_STDERR, { id, data: data.toString() });
      });

      child.on('close', (code) => {
        processes.delete(id);
        win?.webContents.send(StreamChannels.SHELL_EXIT, { id, code });
      });

      child.on('error', (err) => {
        processes.delete(id);
        win?.webContents.send(StreamChannels.SHELL_EXIT, { id, code: -1, error: err.message });
      });

      return { id, pid: child.pid };
    },
  );

  ipcMain.handle(AsyncChannels.SHELL_KILL, async (_event, id: unknown) => {
    assertString(id, 'id');
    const child = processes.get(id);
    if (child) {
      child.kill();
      processes.delete(id);
      return true;
    }
    return false;
  });
}
