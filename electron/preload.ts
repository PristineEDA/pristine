import { contextBridge, ipcRenderer } from 'electron';
import { SyncChannels, AsyncChannels, StreamChannels } from './ipc/channels.js';

// ─── Sync Helpers ─────────────────────────────────────────────────────────────

function syncSend<T>(channel: string, ...args: unknown[]): T {
  return ipcRenderer.sendSync(channel, ...args) as T;
}

// ─── Platform Info (cached at load time) ──────────────────────────────────────

const platformInfo = syncSend<{
  platform: string;
  arch: string;
  versions: { electron: string; node: string; chrome: string };
}>(SyncChannels.PLATFORM);

// ─── Exposed API ──────────────────────────────────────────────────────────────

const electronAPI = {
  platform: platformInfo.platform,
  arch: platformInfo.arch,
  versions: platformInfo.versions,

  // ── Window Control (async) ──
  minimize: () => ipcRenderer.invoke(AsyncChannels.WINDOW_MINIMIZE),
  maximize: () => ipcRenderer.invoke(AsyncChannels.WINDOW_MAXIMIZE),
  close: () => ipcRenderer.invoke(AsyncChannels.WINDOW_CLOSE),
  isMaximized: (): boolean => syncSend(SyncChannels.WINDOW_IS_MAXIMIZED),
  onMaximizedChange: (callback: (maximized: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized);
    ipcRenderer.on(StreamChannels.WINDOW_MAXIMIZED_CHANGE, handler);
    return () => { ipcRenderer.removeListener(StreamChannels.WINDOW_MAXIMIZED_CHANGE, handler); };
  },

  // ── File System (async, project-dir scoped) ──
  fs: {
    readFile: (filePath: string, encoding?: string) =>
      ipcRenderer.invoke(AsyncChannels.FS_READ_FILE, filePath, encoding) as Promise<string>,
    listFiles: (dirPath = '.') =>
      ipcRenderer.invoke(AsyncChannels.FS_LIST_FILES, dirPath) as Promise<string[]>,
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke(AsyncChannels.FS_WRITE_FILE, filePath, content) as Promise<void>,
    readDir: (dirPath: string) =>
      ipcRenderer.invoke(AsyncChannels.FS_READ_DIR, dirPath) as Promise<
        Array<{ name: string; isDirectory: boolean; isFile: boolean }>
      >,
    stat: (filePath: string) =>
      ipcRenderer.invoke(AsyncChannels.FS_STAT, filePath) as Promise<{
        size: number;
        isDirectory: boolean;
        isFile: boolean;
        mtime: string;
        ctime: string;
      }>,
    exists: (filePath: string) =>
      ipcRenderer.invoke(AsyncChannels.FS_EXISTS, filePath) as Promise<boolean>,
  },

  // ── Shell (async + stream) ──
  shell: {
    exec: (command: string, args?: string[], options?: { cwd?: string }) =>
      ipcRenderer.invoke(AsyncChannels.SHELL_EXEC, command, args, options) as Promise<{
        id: string;
        pid: number | undefined;
      }>,
    kill: (id: string) =>
      ipcRenderer.invoke(AsyncChannels.SHELL_KILL, id) as Promise<boolean>,
    onStdout: (callback: (data: { id: string; data: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: { id: string; data: string }) =>
        callback(payload);
      ipcRenderer.on(StreamChannels.SHELL_STDOUT, handler);
      return () => { ipcRenderer.removeListener(StreamChannels.SHELL_STDOUT, handler); };
    },
    onStderr: (callback: (data: { id: string; data: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: { id: string; data: string }) =>
        callback(payload);
      ipcRenderer.on(StreamChannels.SHELL_STDERR, handler);
      return () => { ipcRenderer.removeListener(StreamChannels.SHELL_STDERR, handler); };
    },
    onExit: (callback: (data: { id: string; code: number | null; error?: string }) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: { id: string; code: number | null; error?: string },
      ) => callback(payload);
      ipcRenderer.on(StreamChannels.SHELL_EXIT, handler);
      return () => { ipcRenderer.removeListener(StreamChannels.SHELL_EXIT, handler); };
    },
  },

  // ── Config (sync get, async set) ──
  config: {
    get: (key: string): unknown => syncSend(SyncChannels.CONFIG_GET, key),
    set: (key: string, value: unknown) =>
      ipcRenderer.invoke(AsyncChannels.CONFIG_SET, key, value) as Promise<void>,
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
