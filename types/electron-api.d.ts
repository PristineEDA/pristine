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
  setFloatingInfoWindowVisible: (visible: boolean) => Promise<boolean>;
  isMaximized: () => boolean;
  onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;

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
