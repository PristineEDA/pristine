export const DEFAULT_STARTUP_PROJECT_ROOT = 'C:\\Users\\maksy\\Desktop\\fpga\\retroSoC';
export const DEFAULT_STARTUP_PROJECT_NAME = 'retroSoC';
export const WORKSPACE_ROOT_PATH = '.';

export interface WorkspaceTreeNode {
  id: string;
  path: string;
  name: string;
  type: 'file' | 'folder';
  children?: WorkspaceTreeNode[];
  hasLoadedChildren: boolean;
  isLoading: boolean;
}

export interface WorkspaceDirectoryEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
}

export function normalizeWorkspacePath(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
  return normalized.length === 0 ? WORKSPACE_ROOT_PATH : normalized;
}

export function joinWorkspacePath(parentPath: string, name: string): string {
  if (parentPath === WORKSPACE_ROOT_PATH) {
    return normalizeWorkspacePath(name);
  }

  return normalizeWorkspacePath(`${parentPath}/${name}`);
}

export function getWorkspaceBaseName(filePath: string): string {
  const normalized = normalizeWorkspacePath(filePath);

  if (normalized === WORKSPACE_ROOT_PATH) {
    return DEFAULT_STARTUP_PROJECT_NAME;
  }

  const segments = normalized.split('/');
  return segments[segments.length - 1] ?? normalized;
}

export function getWorkspaceSegments(filePath: string): string[] {
  const normalized = normalizeWorkspacePath(filePath);

  if (normalized === WORKSPACE_ROOT_PATH) {
    return [DEFAULT_STARTUP_PROJECT_NAME];
  }

  return [DEFAULT_STARTUP_PROJECT_NAME, ...normalized.split('/')];
}

export function getEditorLanguage(filePath: string): string {
  const normalized = normalizeWorkspacePath(filePath);
  const lowerCased = normalized.toLowerCase();

  if (lowerCased.endsWith('.sv') || lowerCased.endsWith('.svh')) {
    return 'systemverilog';
  }

  if (lowerCased.endsWith('.v') || lowerCased.endsWith('.vh')) {
    return 'verilog';
  }

  if (lowerCased.endsWith('.md')) {
    return 'markdown';
  }

  if (lowerCased.endsWith('.json')) {
    return 'json';
  }

  if (lowerCased.endsWith('.yml') || lowerCased.endsWith('.yaml')) {
    return 'yaml';
  }

  if (lowerCased.endsWith('.xml') || lowerCased.endsWith('.xdc')) {
    return 'xml';
  }

  if (lowerCased.endsWith('.ts') || lowerCased.endsWith('.tsx')) {
    return 'typescript';
  }

  if (lowerCased.endsWith('.js') || lowerCased.endsWith('.jsx')) {
    return 'javascript';
  }

  if (lowerCased.endsWith('.py')) {
    return 'python';
  }

  return 'plaintext';
}

export function toTreeTestId(path: string): string {
  const normalized = normalizeWorkspacePath(path);

  if (normalized === WORKSPACE_ROOT_PATH) {
    return 'root';
  }

  return normalized.replace(/[/.]/g, '_').replace(/[^A-Za-z0-9_-]/g, '-');
}

export function sortDirectoryEntries(entries: WorkspaceDirectoryEntry[]): WorkspaceDirectoryEntry[] {
  return [...entries].sort((left, right) => {
    if (left.isDirectory !== right.isDirectory) {
      return left.isDirectory ? -1 : 1;
    }

    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export function createWorkspaceNode(
  parentPath: string,
  entry: WorkspaceDirectoryEntry,
): WorkspaceTreeNode {
  const nextPath = joinWorkspacePath(parentPath, entry.name);
  const isFolder = entry.isDirectory;

  return {
    id: nextPath,
    path: nextPath,
    name: entry.name,
    type: isFolder ? 'folder' : 'file',
    children: isFolder ? [] : undefined,
    hasLoadedChildren: !isFolder,
    isLoading: false,
  };
}

export function createRootNode(children: WorkspaceTreeNode[]): WorkspaceTreeNode {
  return {
    id: WORKSPACE_ROOT_PATH,
    path: WORKSPACE_ROOT_PATH,
    name: DEFAULT_STARTUP_PROJECT_NAME,
    type: 'folder',
    children,
    hasLoadedChildren: true,
    isLoading: false,
  };
}