import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock electron / fs ─────────────────────────────────────────────────────

const { mockHandle, mockFs } = vi.hoisted(() => ({
  mockHandle: vi.fn(),
  mockFs: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    access: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  ipcMain: { handle: (...args: unknown[]) => mockHandle(...args) },
}));

vi.mock('node:fs/promises', () => ({ default: mockFs }));

import { registerFilesystemHandlers, setProjectRoot } from '../filesystem.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
  const call = mockHandle.mock.calls.find((c) => c[0] === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1];
}

function createDirent(name: string, type: 'file' | 'directory') {
  return {
    name,
    isDirectory: () => type === 'directory',
    isFile: () => type === 'file',
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('filesystem IPC handlers', () => {
  beforeEach(() => {
    mockHandle.mockClear();
    setProjectRoot('/safe/project');
    registerFilesystemHandlers();
  });

  describe('FS_READ_FILE', () => {
    it('rejects invalid encoding', async () => {
      const handler = getHandler('async:fs:read-file');
      await expect(handler({}, 'file.v', 'evil-enc')).rejects.toThrow('Invalid encoding');
    });

    it('rejects non-string encoding', async () => {
      const handler = getHandler('async:fs:read-file');
      await expect(handler({}, 'file.v', 42)).rejects.toThrow('Expected string');
    });

    it('accepts valid utf-8 encoding', async () => {
      mockFs.readFile.mockResolvedValue('content');
      const handler = getHandler('async:fs:read-file');
      const result = await handler({}, 'src/main.v', 'utf-8');
      expect(result).toBe('content');
    });

    it('accepts undefined encoding (defaults to utf-8)', async () => {
      mockFs.readFile.mockResolvedValue('content');
      const handler = getHandler('async:fs:read-file');
      const result = await handler({}, 'src/main.v');
      expect(result).toBe('content');
      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.any(String),
        { encoding: 'utf-8' },
      );
    });

    it('rejects path traversal', async () => {
      const handler = getHandler('async:fs:read-file');
      await expect(handler({}, '../../etc/passwd')).rejects.toThrow('Path traversal denied');
    });
  });

  describe('FS_WRITE_FILE', () => {
    it('rejects path traversal', async () => {
      const handler = getHandler('async:fs:write-file');
      await expect(handler({}, '../outside.txt', 'data')).rejects.toThrow('Path traversal denied');
    });

    it('rejects non-string content', async () => {
      const handler = getHandler('async:fs:write-file');
      await expect(handler({}, 'file.v', 42)).rejects.toThrow('Expected string');
    });
  });

  describe('FS_EXISTS', () => {
    it('returns true for existing file', async () => {
      mockFs.access.mockResolvedValue(undefined);
      const handler = getHandler('async:fs:exists');
      expect(await handler({}, 'src/main.v')).toBe(true);
    });

    it('returns false for missing file', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));
      const handler = getHandler('async:fs:exists');
      expect(await handler({}, 'missing.v')).toBe(false);
    });
  });

  describe('FS_LIST_FILES', () => {
    it('returns recursively discovered workspace files including dotfiles', async () => {
      mockFs.readdir.mockImplementation(async (resolvedPath: string) => {
        const normalized = resolvedPath.replace(/\\/g, '/');

        if (normalized.endsWith('/safe/project')) {
          return [
            createDirent('README.md', 'file'),
            createDirent('.gitignore', 'file'),
            createDirent('rtl', 'directory'),
          ];
        }

        if (normalized.endsWith('/safe/project/rtl')) {
          return [
            createDirent('core', 'directory'),
            createDirent('top.sv', 'file'),
          ];
        }

        if (normalized.endsWith('/safe/project/rtl/core')) {
          return [
            createDirent('alu.v', 'file'),
          ];
        }

        return [];
      });

      const handler = getHandler('async:fs:list-files');
      await expect(handler({}, '.')).resolves.toEqual([
        '.gitignore',
        'README.md',
        'rtl/core/alu.v',
        'rtl/top.sv',
      ]);
    });

    it('rejects path traversal for recursive file listing', async () => {
      const handler = getHandler('async:fs:list-files');
      await expect(handler({}, '../outside')).rejects.toThrow('Path traversal denied');
    });
  });
});
