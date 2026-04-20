import { contextBridge, ipcRenderer } from 'electron';
import { SyncChannels, AsyncChannels, StreamChannels } from './ipc/channels.js';
import type { SaveDialogResult } from './ipc/dialog.js';
import type { LspCompletionResponse, LspDebugEvent, LspDiagnosticsEvent, LspHover, LspStateEvent, WorkspaceLocation } from '../types/systemverilog-lsp.js';
import type { WorkspaceGitStatusPayload } from '../types/workspace-git.js';
import type { MenuCommandEvent } from '../src/app/menu/applicationMenu.js';
import type { WindowCloseDecision, WindowCloseRequest } from '../src/app/window/windowClose.js';
import type { AuthView, DesktopAuthSession } from '../src/app/auth/types.js';

// ─── Sync Helpers ─────────────────────────────────────────────────────────────

function syncSend<T>(channel: string, ...args: unknown[]): T {
  return ipcRenderer.sendSync(channel, ...args) as T;
}

// ─── Platform Info (local preload process data) ───────────────────────────────

const platformInfo = {
  platform: process.platform,
  arch: process.arch,
  isE2E: process.env['PRISTINE_E2E'] === '1',
  versions: {
    electron: process.versions['electron'],
    node: process.versions['node'],
    chrome: process.versions['chrome'],
  },
};

// ─── Exposed API ──────────────────────────────────────────────────────────────

const electronAPI = {
  platform: platformInfo.platform,
  arch: platformInfo.arch,
  versions: platformInfo.versions,
  isE2E: platformInfo.isE2E,

  // ── Window Control (async) ──
  minimize: () => ipcRenderer.invoke(AsyncChannels.WINDOW_MINIMIZE),
  maximize: () => ipcRenderer.invoke(AsyncChannels.WINDOW_MAXIMIZE),
  show: () => ipcRenderer.invoke(AsyncChannels.WINDOW_SHOW),
  hide: () => ipcRenderer.invoke(AsyncChannels.WINDOW_HIDE),
  close: () => ipcRenderer.invoke(AsyncChannels.WINDOW_CLOSE),
  resolveCloseRequest: (requestId: number, decision: WindowCloseDecision) =>
    ipcRenderer.invoke(AsyncChannels.WINDOW_RESOLVE_CLOSE_REQUEST, requestId, decision) as Promise<boolean>,
  setFloatingInfoWindowVisible: (visible: boolean) =>
    ipcRenderer.invoke(AsyncChannels.WINDOW_SET_FLOATING_INFO_VISIBILITY, visible),
  isMaximized: (): boolean => syncSend(SyncChannels.WINDOW_IS_MAXIMIZED),
  isFullScreen: (): boolean => syncSend(SyncChannels.WINDOW_IS_FULLSCREEN),
  onMaximizedChange: (callback: (maximized: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, maximized: boolean) => callback(maximized);
    ipcRenderer.on(StreamChannels.WINDOW_MAXIMIZED_CHANGE, handler);
    return () => { ipcRenderer.removeListener(StreamChannels.WINDOW_MAXIMIZED_CHANGE, handler); };
  },
  onFullScreenChange: (callback: (fullScreen: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, fullScreen: boolean) => callback(fullScreen);
    ipcRenderer.on(StreamChannels.WINDOW_FULLSCREEN_CHANGE, handler);
    return () => { ipcRenderer.removeListener(StreamChannels.WINDOW_FULLSCREEN_CHANGE, handler); };
  },
  onCloseRequested: (callback: (request: WindowCloseRequest) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, request: WindowCloseRequest) => callback(request);
    ipcRenderer.on(StreamChannels.WINDOW_CLOSE_REQUEST, handler);
    return () => { ipcRenderer.removeListener(StreamChannels.WINDOW_CLOSE_REQUEST, handler); };
  },
  onWindowFocus: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(StreamChannels.WINDOW_FOCUS, handler);
    return () => { ipcRenderer.removeListener(StreamChannels.WINDOW_FOCUS, handler); };
  },

  // ── File System (async, project-dir scoped) ──
  fs: {
    readFile: (filePath: string, encoding?: string) =>
      ipcRenderer.invoke(AsyncChannels.FS_READ_FILE, filePath, encoding) as Promise<string>,
    readFileAbsolute: (filePath: string, encoding?: string) =>
      ipcRenderer.invoke(AsyncChannels.FS_READ_FILE_ABSOLUTE, filePath, encoding) as Promise<string>,
    listFiles: (dirPath = '.') =>
      ipcRenderer.invoke(AsyncChannels.FS_LIST_FILES, dirPath) as Promise<string[]>,
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke(AsyncChannels.FS_WRITE_FILE, filePath, content) as Promise<void>,
    writeFileAbsolute: (filePath: string, content: string) =>
      ipcRenderer.invoke(AsyncChannels.FS_WRITE_FILE_ABSOLUTE, filePath, content) as Promise<void>,
    createDirectory: (dirPath: string) =>
      ipcRenderer.invoke(AsyncChannels.FS_CREATE_DIRECTORY, dirPath) as Promise<void>,
    deleteFile: (filePath: string) =>
      ipcRenderer.invoke(AsyncChannels.FS_DELETE_FILE, filePath) as Promise<void>,
    deleteDirectory: (dirPath: string) =>
      ipcRenderer.invoke(AsyncChannels.FS_DELETE_DIRECTORY, dirPath) as Promise<void>,
    rename: (currentPath: string, nextPath: string) =>
      ipcRenderer.invoke(AsyncChannels.FS_RENAME, currentPath, nextPath) as Promise<void>,
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

  dialog: {
    showSaveDialog: (defaultPath?: string) =>
      ipcRenderer.invoke(AsyncChannels.DIALOG_SHOW_SAVE, defaultPath) as Promise<SaveDialogResult>,
  },

  git: {
    getStatus: () =>
      ipcRenderer.invoke(AsyncChannels.GIT_GET_STATUS) as Promise<WorkspaceGitStatusPayload>,
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

  terminal: {
    create: (options?: { cwd?: string; cols?: number; rows?: number }) =>
      ipcRenderer.invoke(AsyncChannels.TERMINAL_CREATE, options) as Promise<{
        id: string;
        pid: number;
        shell: string;
      }>,
    write: (id: string, data: string) =>
      ipcRenderer.invoke(AsyncChannels.TERMINAL_WRITE, id, data) as Promise<boolean>,
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke(AsyncChannels.TERMINAL_RESIZE, id, cols, rows) as Promise<boolean>,
    kill: (id: string) =>
      ipcRenderer.invoke(AsyncChannels.TERMINAL_KILL, id) as Promise<boolean>,
    onData: (callback: (data: { id: string; data: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: { id: string; data: string }) =>
        callback(payload);
      ipcRenderer.on(StreamChannels.TERMINAL_DATA, handler);
      return () => { ipcRenderer.removeListener(StreamChannels.TERMINAL_DATA, handler); };
    },
    onExit: (callback: (data: { id: string; exitCode: number; signal: number }) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        payload: { id: string; exitCode: number; signal: number },
      ) => callback(payload);
      ipcRenderer.on(StreamChannels.TERMINAL_EXIT, handler);
      return () => { ipcRenderer.removeListener(StreamChannels.TERMINAL_EXIT, handler); };
    },
  },

  lsp: {
    openDocument: (filePath: string, languageId: string, text: string) =>
      ipcRenderer.invoke(AsyncChannels.LSP_OPEN_DOCUMENT, filePath, languageId, text) as Promise<void>,
    changeDocument: (filePath: string, text: string) =>
      ipcRenderer.invoke(AsyncChannels.LSP_CHANGE_DOCUMENT, filePath, text) as Promise<void>,
    closeDocument: (filePath: string) =>
      ipcRenderer.invoke(AsyncChannels.LSP_CLOSE_DOCUMENT, filePath) as Promise<void>,
    completion: (
      filePath: string,
      line: number,
      character: number,
      triggerCharacter?: string,
      triggerKind?: number,
    ) => ipcRenderer.invoke(
      AsyncChannels.LSP_COMPLETION,
      filePath,
      line,
      character,
      triggerCharacter,
      triggerKind,
    ) as Promise<LspCompletionResponse | null>,
    hover: (filePath: string, line: number, character: number) =>
      ipcRenderer.invoke(AsyncChannels.LSP_HOVER, filePath, line, character) as Promise<LspHover | null>,
    definition: (filePath: string, line: number, character: number) =>
      ipcRenderer.invoke(AsyncChannels.LSP_DEFINITION, filePath, line, character) as Promise<WorkspaceLocation[]>,
    references: (filePath: string, line: number, character: number, includeDeclaration = true) =>
      ipcRenderer.invoke(
        AsyncChannels.LSP_REFERENCES,
        filePath,
        line,
        character,
        includeDeclaration,
      ) as Promise<WorkspaceLocation[]>,
    onDiagnostics: (callback: (payload: LspDiagnosticsEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: LspDiagnosticsEvent) => callback(payload);
      ipcRenderer.on(StreamChannels.LSP_DIAGNOSTICS, handler);
      return () => { ipcRenderer.removeListener(StreamChannels.LSP_DIAGNOSTICS, handler); };
    },
    onDebug: (callback: (payload: LspDebugEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: LspDebugEvent) => callback(payload);
      ipcRenderer.on(StreamChannels.LSP_DEBUG, handler);
      return () => { ipcRenderer.removeListener(StreamChannels.LSP_DEBUG, handler); };
    },
    onState: (callback: (payload: LspStateEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: LspStateEvent) => callback(payload);
      ipcRenderer.on(StreamChannels.LSP_STATE, handler);
      return () => { ipcRenderer.removeListener(StreamChannels.LSP_STATE, handler); };
    },
  },

  menu: {
    onCommand: (callback: (payload: MenuCommandEvent) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: MenuCommandEvent) => callback(payload);
      ipcRenderer.on(StreamChannels.MENU_COMMAND, handler);
      return () => { ipcRenderer.removeListener(StreamChannels.MENU_COMMAND, handler); };
    },
  },

  auth: {
    openAccountPage: (view: AuthView) =>
      ipcRenderer.invoke(AsyncChannels.AUTH_OPEN_ACCOUNT_PAGE, view) as Promise<boolean>,
    getSession: () =>
      ipcRenderer.invoke(AsyncChannels.AUTH_GET_SESSION) as Promise<DesktopAuthSession | null>,
    signOut: () =>
      ipcRenderer.invoke(AsyncChannels.AUTH_SIGN_OUT) as Promise<boolean>,
    syncCloudConfig: () =>
      ipcRenderer.invoke(AsyncChannels.AUTH_SYNC_CONFIG) as Promise<boolean>,
    onStateChanged: (callback: (session: DesktopAuthSession | null) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, session: DesktopAuthSession | null) => callback(session);
      ipcRenderer.on(StreamChannels.AUTH_STATE_CHANGED, handler);
      return () => { ipcRenderer.removeListener(StreamChannels.AUTH_STATE_CHANGED, handler); };
    },
    onError: (callback: (message: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, message: string) => callback(message);
      ipcRenderer.on(StreamChannels.AUTH_ERROR, handler);
      return () => { ipcRenderer.removeListener(StreamChannels.AUTH_ERROR, handler); };
    },
  },

  // ── Config (sync get, async set) ──
  config: {
    get: (key: string): unknown => syncSend(SyncChannels.CONFIG_GET, key),
    set: (key: string, value: unknown) =>
      ipcRenderer.invoke(AsyncChannels.CONFIG_SET, key, value) as Promise<void>,
    onDidChange: (callback: (key: string, value: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: { key: string; value: unknown }) =>
        callback(payload.key, payload.value);
      ipcRenderer.on(StreamChannels.CONFIG_CHANGED, handler);
      return () => { ipcRenderer.removeListener(StreamChannels.CONFIG_CHANGED, handler); };
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
