import { ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import ignore from 'ignore';
import { AsyncChannels } from './channels.js';
import { validatePathWithinRoot, assertString, assertValidEncoding } from './validators.js';

let projectRoot: string | null = null;

export function setProjectRoot(root: string): void {
  projectRoot = path.resolve(root);
}

function getRoot(): string {
  if (!projectRoot) {
    throw new Error('Project root not set');
  }
  return projectRoot;
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
}

function prefixGitIgnorePattern(pattern: string, dirPath: string): string[] {
  const line = pattern.replace(/\r$/, '');

  if (line.trim().length === 0 || line.startsWith('#')) {
    return [];
  }

  const isNegated = line.startsWith('!') && !line.startsWith('\\!');
  const rawBody = isNegated ? line.slice(1) : line;
  const body = rawBody.startsWith('\\#') ? rawBody.slice(1) : rawBody;
  const normalizedDirPath = normalizeRelativePath(dirPath);
  const basePrefix = normalizedDirPath === '.' || normalizedDirPath.length === 0 ? '' : `${normalizedDirPath}/`;
  const isAnchored = body.startsWith('/');
  const normalizedBody = body.replace(/^\//, '');
  const bodyWithoutDirectoryMarker = normalizedBody.endsWith('/')
    ? normalizedBody.slice(0, -1)
    : normalizedBody;
  const hasSlash = bodyWithoutDirectoryMarker.includes('/');
  const variants = isAnchored || hasSlash
    ? [`${basePrefix}${normalizedBody}`]
    : [`${basePrefix}${normalizedBody}`, `${basePrefix}**/${normalizedBody}`];

  return variants.map((variant) => (isNegated ? `!${variant}` : variant));
}

async function readGitIgnorePatterns(dirPath: string, entryNames: Set<string>): Promise<string[]> {
  if (!entryNames.has('.gitignore')) {
    return [];
  }

  const gitIgnorePath = dirPath === '.' ? '.gitignore' : `${dirPath}/.gitignore`;
  const resolved = validatePathWithinRoot(getRoot(), gitIgnorePath);
  const contents = await fs.readFile(resolved, { encoding: 'utf-8' });

  return contents
    .split(/\n/g)
    .flatMap((line) => prefixGitIgnorePattern(line, dirPath));
}

async function listFilesRecursive(dirPath: string, inheritedIgnorePatterns: string[] = []): Promise<string[]> {
  const resolved = validatePathWithinRoot(getRoot(), dirPath);
  const entries = await fs.readdir(resolved, { withFileTypes: true });
  const entryNames = new Set(entries.map((entry) => entry.name));
  const localIgnorePatterns = await readGitIgnorePatterns(dirPath, entryNames);
  const ignorePatterns = [...inheritedIgnorePatterns, ...localIgnorePatterns];
  const matcher = ignore().add(ignorePatterns);
  const results: string[] = [];

  for (const entry of entries) {
    const childPath = dirPath === '.' ? entry.name : `${dirPath}/${entry.name}`;
    const normalizedChildPath = normalizeRelativePath(childPath);

    if (entry.isDirectory() && entry.name === '.git') {
      continue;
    }

    if (matcher.ignores(entry.isDirectory() ? `${normalizedChildPath}/` : normalizedChildPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      results.push(...await listFilesRecursive(childPath, ignorePatterns));
      continue;
    }

    if (entry.isFile()) {
      results.push(normalizedChildPath);
    }
  }

  return results;
}

export function registerFilesystemHandlers(): void {
  ipcMain.handle(AsyncChannels.FS_READ_FILE, async (_event, filePath: unknown, encoding?: unknown) => {
    assertString(filePath, 'filePath');
    assertValidEncoding(encoding, 'encoding');
    const resolved = validatePathWithinRoot(getRoot(), filePath);
    const enc = (encoding as BufferEncoding) ?? 'utf-8';
    return fs.readFile(resolved, { encoding: enc });
  });

  ipcMain.handle(AsyncChannels.FS_LIST_FILES, async (_event, dirPath: unknown = '.') => {
    assertString(dirPath, 'dirPath');
    const files = await listFilesRecursive(dirPath);
    return files.sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));
  });

  ipcMain.handle(AsyncChannels.FS_WRITE_FILE, async (_event, filePath: unknown, content: unknown) => {
    assertString(filePath, 'filePath');
    assertString(content, 'content');
    const resolved = validatePathWithinRoot(getRoot(), filePath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf-8');
  });

  ipcMain.handle(AsyncChannels.FS_READ_DIR, async (_event, dirPath: unknown) => {
    assertString(dirPath, 'dirPath');
    const resolved = validatePathWithinRoot(getRoot(), dirPath);
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    return entries.map((e) => ({
      name: e.name,
      isDirectory: e.isDirectory(),
      isFile: e.isFile(),
    }));
  });

  ipcMain.handle(AsyncChannels.FS_STAT, async (_event, filePath: unknown) => {
    assertString(filePath, 'filePath');
    const resolved = validatePathWithinRoot(getRoot(), filePath);
    const stat = await fs.stat(resolved);
    return {
      size: stat.size,
      isDirectory: stat.isDirectory(),
      isFile: stat.isFile(),
      mtime: stat.mtime.toISOString(),
      ctime: stat.ctime.toISOString(),
    };
  });

  ipcMain.handle(AsyncChannels.FS_EXISTS, async (_event, filePath: unknown) => {
    assertString(filePath, 'filePath');
    const resolved = validatePathWithinRoot(getRoot(), filePath);
    try {
      await fs.access(resolved);
      return true;
    } catch {
      return false;
    }
  });
}
