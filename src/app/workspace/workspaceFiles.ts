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

export function getWorkspaceAncestorPaths(filePath: string): string[] {
  const normalized = normalizeWorkspacePath(filePath);

  if (normalized === WORKSPACE_ROOT_PATH) {
    return [WORKSPACE_ROOT_PATH];
  }

  const folders = normalized.split('/').slice(0, -1);
  const ancestorPaths = [WORKSPACE_ROOT_PATH];

  for (let index = 0; index < folders.length; index += 1) {
    ancestorPaths.push(folders.slice(0, index + 1).join('/'));
  }

  return ancestorPaths;
}

export function getEditorLanguage(filePath: string): string {
  const normalized = normalizeWorkspacePath(filePath);
  const lowerCased = normalized.toLowerCase();

  if (lowerCased === 'makefile' || lowerCased.endsWith('/makefile') || lowerCased.endsWith('.mk')) {
    return 'makefile';
  }

  if (lowerCased.endsWith('.s')) {
    return 'assembly';
  }

  if (lowerCased.endsWith('.sh')) {
    return 'shell';
  }

  if (lowerCased.endsWith('.tcl')) {
    return 'tcl';
  }

  if (lowerCased.endsWith('.ld') || lowerCased.endsWith('.lds')) {
    return 'linker-script';
  }

  if (lowerCased.endsWith('.f') || lowerCased.endsWith('.fl')) {
    return 'filelist';
  }

  if (lowerCased.endsWith('.sdc') || lowerCased.endsWith('.xdc')) {
    return 'constraints';
  }

  if (lowerCased.endsWith('.sv') || lowerCased.endsWith('.svh')) {
    return 'systemverilog';
  }

  if (lowerCased.endsWith('.v') || lowerCased.endsWith('.vh')) {
    return 'verilog';
  }

  if (lowerCased.endsWith('.md')) {
    return 'markdown';
  }

  if (lowerCased.endsWith('.c') || lowerCased.endsWith('.h')) {
    return 'c';
  }

  if (lowerCased.endsWith('.cpp') || lowerCased.endsWith('.hpp')) {
    return 'cpp';
  }

  if (lowerCased.endsWith('.json')) {
    return 'json';
  }

  if (lowerCased.endsWith('.yml') || lowerCased.endsWith('.yaml')) {
    return 'yaml';
  }

  if (lowerCased.endsWith('.xml')) {
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

export function getEditorLanguageLabel(filePath: string): string {
  const normalized = normalizeWorkspacePath(filePath).toLowerCase();

  if (normalized === 'makefile' || normalized.endsWith('/makefile') || normalized.endsWith('.mk')) {
    return 'Makefile';
  }

  if (normalized.endsWith('.s')) {
    return 'Assembly';
  }

  if (normalized.endsWith('.sh')) {
    return 'Shell';
  }

  if (normalized.endsWith('.xdc')) {
    return 'XDC';
  }

  if (normalized.endsWith('.sdc')) {
    return 'SDC';
  }

  if (normalized.endsWith('.tcl')) {
    return 'Tcl';
  }

  if (normalized.endsWith('.ld') || normalized.endsWith('.lds')) {
    return 'Linker Script';
  }

  if (normalized.endsWith('.f') || normalized.endsWith('.fl')) {
    return 'File List';
  }

  const language = getEditorLanguage(filePath);

  if (language === 'systemverilog') {
    return 'SystemVerilog';
  }

  if (language === 'verilog') {
    return 'Verilog';
  }

  if (language === 'markdown') {
    return 'Markdown';
  }

  if (language === 'json') {
    return 'JSON';
  }

  if (language === 'yaml') {
    return 'YAML';
  }

  if (language === 'xml') {
    return 'XML';
  }

  if (language === 'tcl') {
    return 'Tcl';
  }

  if (language === 'constraints') {
    return 'Constraints';
  }

  if (language === 'typescript') {
    return 'TypeScript';
  }

  if (language === 'javascript') {
    return 'JavaScript';
  }

  if (language === 'python') {
    return 'Python';
  }

  if (language === 'c') {
    return 'C';
  }

  if (language === 'cpp') {
    return 'C++';
  }

  return 'Plain Text';
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