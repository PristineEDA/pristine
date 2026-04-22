import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type WorkspaceRevealRequest, useWorkspaceTree } from './useWorkspaceTree';

describe('useWorkspaceTree', () => {
  beforeEach(() => {
    const electronApi = window.electronAPI!;

    vi.clearAllMocks();

    vi.mocked(electronApi.fs.exists).mockResolvedValue(true);
    vi.mocked(electronApi.fs.readDir).mockImplementation(async (dirPath: string) => {
      if (dirPath === '.') {
        return [{ name: 'rtl', isDirectory: true, isFile: false }];
      }

      if (dirPath === 'rtl') {
        return [{ name: 'peripherals', isDirectory: true, isFile: false }];
      }

      if (dirPath === 'rtl/peripherals') {
        return [{ name: 'uart_rx.v', isDirectory: false, isFile: true }];
      }

      return [];
    });
  });

  it('keeps the expanded folder state stable when revealing within already expanded ancestors', async () => {
    const { result, rerender } = renderHook(
      ({ revealRequest }: { revealRequest?: WorkspaceRevealRequest | null }) => useWorkspaceTree(revealRequest),
      {
        initialProps: {
          revealRequest: { path: 'rtl/peripherals/uart_rx.v', token: 1 },
        },
      },
    );

    await waitFor(() => {
      expect(result.current.workspaceAvailable).toBe(true);
      expect(result.current.expandedFolders.has('rtl')).toBe(true);
      expect(result.current.expandedFolders.has('rtl/peripherals')).toBe(true);
      expect(window.electronAPI!.fs.readDir).toHaveBeenCalledTimes(3);
    });

    const expandedFoldersAfterFirstReveal = result.current.expandedFolders;

    act(() => {
      rerender({ revealRequest: { path: 'rtl/peripherals/uart_rx.v', token: 2 } });
    });

    expect(result.current.expandedFolders).toBe(expandedFoldersAfterFirstReveal);
    expect(window.electronAPI!.fs.readDir).toHaveBeenCalledTimes(3);
  });

  it('reloads already expanded folders after a refresh token bump', async () => {
    const { result, rerender } = renderHook(
      ({ refreshToken }: { refreshToken: number }) => useWorkspaceTree(undefined, refreshToken),
      {
        initialProps: {
          refreshToken: 0,
        },
      },
    );

    await waitFor(() => {
      expect(result.current.workspaceAvailable).toBe(true);
    });

    act(() => {
      result.current.toggleFolder('rtl');
    });

    await waitFor(() => {
      expect(window.electronAPI!.fs.readDir).toHaveBeenCalledWith('rtl');
    });

    act(() => {
      result.current.toggleFolder('rtl/peripherals');
    });

    await waitFor(() => {
      expect(window.electronAPI!.fs.readDir).toHaveBeenCalledWith('rtl/peripherals');
    });

    const readDirCallCount = vi.mocked(window.electronAPI!.fs.readDir).mock.calls.length;

    act(() => {
      rerender({ refreshToken: 1 });
    });

    await waitFor(() => {
      expect(window.electronAPI!.fs.readDir).toHaveBeenCalledTimes(readDirCallCount + 3);
    });

    expect(result.current.expandedFolders.has('rtl')).toBe(true);
    expect(result.current.expandedFolders.has('rtl/peripherals')).toBe(true);
  });
});