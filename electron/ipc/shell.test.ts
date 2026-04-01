import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';

// ─── Mock electron / child_process before importing module ────────────────

const mockHandle = vi.fn();
vi.mock('electron', () => ({
  ipcMain: { handle: (...args: unknown[]) => mockHandle(...args) },
  BrowserWindow: class {},
}));

const mockSpawn = vi.fn();
vi.mock('node:child_process', () => {
  const spawn = (...args: unknown[]) => mockSpawn(...args);

  return {
    default: { spawn },
    spawn,
  };
});

import { registerShellHandlers, setShellProjectRoot } from './shell.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
  const call = mockHandle.mock.calls.find((c) => c[0] === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1];
}

function makeFakeProcess() {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    pid: 12345,
    stdout: {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => { handlers[`stdout:${event}`] = cb; }),
    },
    stderr: {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => { handlers[`stderr:${event}`] = cb; }),
    },
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => { handlers[event] = cb; }),
    kill: vi.fn(),
    _handlers: handlers,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('shell IPC handlers', () => {
  const getMainWindow = () => ({ webContents: { send: vi.fn() } } as any);

  beforeEach(() => {
    mockHandle.mockClear();
    mockSpawn.mockClear();
    registerShellHandlers(getMainWindow);
  });

  describe('SHELL_EXEC', () => {
    it('rejects commands not in the allowlist', async () => {
      const handler = getHandler('async:shell:exec');
      await expect(handler({}, 'rm')).rejects.toThrow('Command not allowed');
    });

    it('rejects non-string command', async () => {
      const handler = getHandler('async:shell:exec');
      await expect(handler({}, 42)).rejects.toThrow('Expected string');
    });

    it('allows verilator command', async () => {
      const fakeProc = makeFakeProcess();
      mockSpawn.mockReturnValue(fakeProc);
      const handler = getHandler('async:shell:exec');
      const result = await handler({}, 'verilator', ['--lint-only', 'top.v']);
      expect(result).toEqual({ id: expect.any(String), pid: 12345 });
      expect(mockSpawn).toHaveBeenCalledWith(
        'verilator',
        ['--lint-only', 'top.v'],
        expect.objectContaining({ shell: false }),
      );
    });

    it('allows make command', async () => {
      const fakeProc = makeFakeProcess();
      mockSpawn.mockReturnValue(fakeProc);
      const handler = getHandler('async:shell:exec');
      const result = await handler({}, 'make', ['lint']);
      expect(result).toEqual({ id: expect.any(String), pid: 12345 });
    });

    it('allows python command', async () => {
      const fakeProc = makeFakeProcess();
      mockSpawn.mockReturnValue(fakeProc);
      const handler = getHandler('async:shell:exec');
      const result = await handler({}, 'python', ['-m', 'cocotb']);
      expect(result).toEqual({ id: expect.any(String), pid: 12345 });
    });

    it('rejects non-string args', async () => {
      const handler = getHandler('async:shell:exec');
      await expect(handler({}, 'make', [42])).rejects.toThrow('Expected string');
    });

    it('validates cwd within project root', async () => {
      const root = path.resolve('/safe/project');
      setShellProjectRoot(root);
      const handler = getHandler('async:shell:exec');
      await expect(
        handler({}, 'make', [], { cwd: '../../etc' }),
      ).rejects.toThrow('Path traversal denied');
    });

    it('enforces concurrency limit', async () => {
      // Each previous test may have added processes that never 'close'd.
      // Re-register fresh handlers to test from a clean module state.
      // Since processes map is module-level, we need enough spawns to hit the cap.
      // First spawn enough to guarantee we're at the limit.
      const fakeProc = makeFakeProcess();
      mockSpawn.mockReturnValue(fakeProc);
      const handler = getHandler('async:shell:exec');

      // Spawn until we hit the limit
      const results: unknown[] = [];
      for (let i = 0; i < 20; i++) {
        try {
          results.push(await handler({}, 'make', []));
        } catch (e: any) {
          expect(e.message).toContain('Too many concurrent processes');
          return; // Test passes — we hit the limit
        }
      }
      // If we never threw, fail
      expect.unreachable('Should have thrown concurrency limit error');
    });
  });

  describe('SHELL_KILL', () => {
    it('rejects non-string id', async () => {
      const handler = getHandler('async:shell:kill');
      await expect(handler({}, 42)).rejects.toThrow('Expected string');
    });

    it('returns false for unknown id', async () => {
      const handler = getHandler('async:shell:kill');
      const result = await handler({}, 'nonexistent');
      expect(result).toBe(false);
    });
  });
});
