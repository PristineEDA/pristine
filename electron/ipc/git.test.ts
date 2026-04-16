import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockHandle = vi.fn();

vi.mock('electron', () => ({
  ipcMain: { handle: (...args: unknown[]) => mockHandle(...args) },
}));

const mockReadDir = vi.fn();
vi.mock('node:fs/promises', () => ({
  default: {
    readdir: (...args: unknown[]) => mockReadDir(...args),
  },
}));

const mockExecFile = vi.fn();
vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

import { registerGitHandlers, setGitProjectRoot } from './git.js';

function getHandler(channel: string): (...args: unknown[]) => Promise<unknown> {
  const call = mockHandle.mock.calls.find((currentCall) => currentCall[0] === channel);
  if (!call) {
    throw new Error(`No handler registered for ${channel}`);
  }

  return call[1];
}

function createDirent(name: string) {
  return { name };
}

describe('git IPC handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGitProjectRoot('C:/workspace/project-root');
    registerGitHandlers();
  });

  it('returns the default fallback when the project has no visible files', async () => {
    mockReadDir.mockResolvedValue([createDirent('.git')]);

    const handler = getHandler('async:git:get-status');
    await expect(handler({})).resolves.toEqual({
      branchName: null,
      hasProjectFiles: false,
      isGitRepo: false,
      pathStates: {},
    });

    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('falls back to a non-git snapshot when git status fails', async () => {
    mockReadDir.mockResolvedValue([createDirent('rtl')]);
    mockExecFile.mockImplementation((
      _command: string,
      _args: string[],
      _options: Record<string, unknown>,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => {
      callback(new Error('fatal: not a git repository'), '', 'fatal: not a git repository');
    });

    const handler = getHandler('async:git:get-status');
    await expect(handler({})).resolves.toEqual({
      branchName: null,
      hasProjectFiles: true,
      isGitRepo: false,
      pathStates: {},
    });
  });

  it('parses branch, modified files, ignored files, and ignored folders from git status', async () => {
    mockReadDir.mockResolvedValue([createDirent('rtl'), createDirent('build')]);
    mockExecFile.mockImplementation((
      _command: string,
      _args: string[],
      _options: Record<string, unknown>,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => {
      callback(null, [
        '## feature/git-ui...origin/feature/git-ui',
        ' M rtl/core/cpu_top.sv',
        'A  rtl/core/alu.v',
        'R  rtl/core/old_name.v -> rtl/core/new_name.v',
        '!! build/',
        '!! logs/sim.log',
        '?? scratch/tmp.v',
      ].join('\n'), '');
    });

    const handler = getHandler('async:git:get-status');
    await expect(handler({})).resolves.toEqual({
      branchName: 'feature/git-ui',
      hasProjectFiles: true,
      isGitRepo: true,
      pathStates: {
        'rtl/core/cpu_top.sv': 'modified',
        'rtl/core/alu.v': 'modified',
        'rtl/core/new_name.v': 'modified',
        build: 'ignored',
        'logs/sim.log': 'ignored',
      },
    });

    expect(mockExecFile).toHaveBeenCalledWith(
      'git',
      [
        '-c',
        'status.relativePaths=true',
        'status',
        '--porcelain=1',
        '--branch',
        '--ignored=matching',
        '--untracked-files=all',
        '--',
        '.',
      ],
      expect.objectContaining({
        cwd: expect.stringMatching(/project-root$/),
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      }),
      expect.any(Function),
    );
  });

  it('extracts the branch name for unborn branches', async () => {
    mockReadDir.mockResolvedValue([createDirent('rtl')]);
    mockExecFile.mockImplementation((
      _command: string,
      _args: string[],
      _options: Record<string, unknown>,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => {
      callback(null, '## No commits yet on main\n', '');
    });

    const handler = getHandler('async:git:get-status');
    await expect(handler({})).resolves.toEqual({
      branchName: 'main',
      hasProjectFiles: true,
      isGitRepo: true,
      pathStates: {},
    });
  });
});