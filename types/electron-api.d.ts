import type {
  LspCompletionResponse,
  LspDebugEvent,
  LspDiagnosticsEvent,
  LspHover,
  LspStateEvent,
  WorkspaceLocation,
} from './systemverilog-lsp';
import type { WorkspaceGitStatusPayload } from './workspace-git';
import type { MenuCommandEvent } from '../src/app/menu/applicationMenu';
import type { WindowCloseDecision, WindowCloseRequest } from '../src/app/window/windowClose';

export interface ElectronAPI {
  platform: string;
  arch: string;
  isE2E: boolean;
  versions: {
    electron: string;
    node: string;
    chrome: string;
  };

  // Window control
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  show: () => Promise<void>;
  hide: () => Promise<void>;
  close: () => Promise<void>;
  resolveCloseRequest: (requestId: number, decision: WindowCloseDecision) => Promise<boolean>;
  setFloatingInfoWindowVisible: (visible: boolean) => Promise<boolean>;
  isMaximized: () => boolean;
  isFullScreen: () => boolean;
  onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;
  onFullScreenChange: (callback: (fullScreen: boolean) => void) => () => void;
  onCloseRequested: (callback: (request: WindowCloseRequest) => void) => () => void;

  // File system (project-dir scoped)
  fs: {
    readFile: (filePath: string, encoding?: string) => Promise<string>;
    listFiles: (dirPath?: string) => Promise<string[]>;
    writeFile: (filePath: string, content: string) => Promise<void>;
    readDir: (dirPath: string) => Promise<Array<{
      name: string;
      isDirectory: boolean;
      isFile: boolean;
    }>>;
    stat: (filePath: string) => Promise<{
      size: number;
      isDirectory: boolean;
      isFile: boolean;
      mtime: string;
      ctime: string;
    }>;
    exists: (filePath: string) => Promise<boolean>;
  };

  git: {
    getStatus: () => Promise<WorkspaceGitStatusPayload>;
  };

  // Shell (isolated subprocess)
  shell: {
    exec: (command: string, args?: string[], options?: { cwd?: string }) => Promise<{
      id: string;
      pid: number | undefined;
    }>;
    kill: (id: string) => Promise<boolean>;
    onStdout: (callback: (data: { id: string; data: string }) => void) => () => void;
    onStderr: (callback: (data: { id: string; data: string }) => void) => () => void;
    onExit: (callback: (data: { id: string; code: number | null; error?: string }) => void) => () => void;
  };

  terminal: {
    create: (options?: { cwd?: string; cols?: number; rows?: number }) => Promise<{
      id: string;
      pid: number;
      shell: string;
    }>;
    write: (id: string, data: string) => Promise<boolean>;
    resize: (id: string, cols: number, rows: number) => Promise<boolean>;
    kill: (id: string) => Promise<boolean>;
    onData: (callback: (data: { id: string; data: string }) => void) => () => void;
    onExit: (callback: (data: { id: string; exitCode: number; signal: number }) => void) => () => void;
  };

  lsp: {
    openDocument: (filePath: string, languageId: string, text: string) => Promise<void>;
    changeDocument: (filePath: string, text: string) => Promise<void>;
    closeDocument: (filePath: string) => Promise<void>;
    completion: (
      filePath: string,
      line: number,
      character: number,
      triggerCharacter?: string,
      triggerKind?: number,
    ) => Promise<LspCompletionResponse | null>;
    hover: (filePath: string, line: number, character: number) => Promise<LspHover | null>;
    definition: (filePath: string, line: number, character: number) => Promise<WorkspaceLocation[]>;
    references: (
      filePath: string,
      line: number,
      character: number,
      includeDeclaration?: boolean,
    ) => Promise<WorkspaceLocation[]>;
    onDebug: (callback: (payload: LspDebugEvent) => void) => () => void;
    onDiagnostics: (callback: (payload: LspDiagnosticsEvent) => void) => () => void;
    onState: (callback: (payload: LspStateEvent) => void) => () => void;
  };

  menu: {
    onCommand: (callback: (payload: MenuCommandEvent) => void) => () => void;
  };

  // Config
  config: {
    get: (key: string) => unknown;
    set: (key: string, value: unknown) => Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
