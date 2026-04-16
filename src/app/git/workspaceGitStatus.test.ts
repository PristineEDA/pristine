import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getWorkspaceGitBranchLabel,
  getWorkspaceGitPathState,
  refreshWorkspaceGitStatus,
  resetWorkspaceGitStatusStoreForTests,
  useWorkspaceGitStatus,
} from './workspaceGitStatus';

describe('workspaceGitStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkspaceGitStatusStoreForTests();
  });

  it('loads and normalizes the workspace git snapshot from the Electron bridge', async () => {
    vi.mocked(window.electronAPI!.git.getStatus).mockResolvedValueOnce({
      branchName: 'feature/git-ui',
      hasProjectFiles: true,
      isGitRepo: true,
      pathStates: {
        './rtl/core/cpu_top.sv': 'modified',
        'build/': 'ignored',
      },
    });

    const { result } = renderHook(() => useWorkspaceGitStatus());

    await waitFor(() => {
      expect(result.current.isGitRepo).toBe(true);
    });

    expect(result.current.pathStates).toEqual({
      'rtl/core/cpu_top.sv': 'modified',
      build: 'ignored',
    });
    expect(getWorkspaceGitBranchLabel(result.current)).toBe('feature/git-ui');
    expect(getWorkspaceGitPathState(result.current, './rtl/core/cpu_top.sv')).toBe('modified');
  });

  it('falls back to git when the workspace has no visible project files or is not a git repository', () => {
    expect(getWorkspaceGitBranchLabel({
      branchName: 'feature/git-ui',
      hasProjectFiles: false,
      isGitRepo: true,
      isLoading: false,
      pathStates: {},
    })).toBe('git');

    expect(getWorkspaceGitBranchLabel({
      branchName: null,
      hasProjectFiles: true,
      isGitRepo: false,
      isLoading: false,
      pathStates: {},
    })).toBe('git');
  });

  it('refreshes the cached snapshot on demand', async () => {
    vi.mocked(window.electronAPI!.git.getStatus)
      .mockResolvedValueOnce({
        branchName: 'main',
        hasProjectFiles: true,
        isGitRepo: true,
        pathStates: {},
      })
      .mockResolvedValueOnce({
        branchName: 'feature/git-ui',
        hasProjectFiles: true,
        isGitRepo: true,
        pathStates: {
          'rtl/core/reg_file.v': 'modified',
        },
      });

    const { result } = renderHook(() => useWorkspaceGitStatus());

    await waitFor(() => {
      expect(result.current.branchName).toBe('main');
    });

    act(() => {
      refreshWorkspaceGitStatus();
    });

    await waitFor(() => {
      expect(result.current.branchName).toBe('feature/git-ui');
    });
    expect(getWorkspaceGitPathState(result.current, 'rtl/core/reg_file.v')).toBe('modified');
  });
});