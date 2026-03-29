import { ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
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

async function listFilesRecursive(dirPath: string): Promise<string[]> {
  const resolved = validatePathWithinRoot(getRoot(), dirPath);
  const entries = await fs.readdir(resolved, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const childPath = dirPath === '.' ? entry.name : `${dirPath}/${entry.name}`;

    if (entry.isDirectory()) {
      results.push(...await listFilesRecursive(childPath));
      continue;
    }

    if (entry.isFile()) {
      results.push(normalizeRelativePath(childPath));
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
