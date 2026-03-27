export interface ElectronAPI {
  platform: string;
  arch: string;
  versions: {
    electron: string;
    node: string;
    chrome: string;
  };

  // Window control
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => boolean;
  onMaximizedChange: (callback: (maximized: boolean) => void) => () => void;

  // File system (project-dir scoped)
  fs: {
    readFile: (filePath: string, encoding?: string) => Promise<string>;
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
