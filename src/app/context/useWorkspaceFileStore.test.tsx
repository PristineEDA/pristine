import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceFileStore } from './useWorkspaceFileStore';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

describe('useWorkspaceFileStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads file contents once and caches the result', async () => {
    const deferred = createDeferred<string>();
    vi.mocked(window.electronAPI!.fs.readFile).mockReturnValueOnce(deferred.promise);

    const { result } = renderHook(() => useWorkspaceFileStore());

    act(() => {
      result.current.loadFileContent('rtl/main.v');
      result.current.loadFileContent('rtl/main.v');
    });

    expect(window.electronAPI?.fs.readFile).toHaveBeenCalledTimes(1);
    expect(window.electronAPI?.fs.readFile).toHaveBeenCalledWith('rtl/main.v', 'utf-8');
    expect(result.current.loadingFiles['rtl/main.v']).toBe(true);

    deferred.resolve('module main; endmodule');

    await waitFor(() => {
      expect(result.current.fileContents['rtl/main.v']).toBe('module main; endmodule');
    });

    expect(result.current.loadingFiles['rtl/main.v']).toBe(false);
    expect(result.current.dirtyFiles['rtl/main.v']).toBe(false);

    act(() => {
      result.current.loadFileContent('rtl/main.v');
    });

    expect(window.electronAPI?.fs.readFile).toHaveBeenCalledTimes(1);
  });

  it('records a clear error when the filesystem bridge is unavailable', async () => {
    const originalFs = window.electronAPI?.fs;
    if (window.electronAPI) {
      window.electronAPI.fs = undefined as never;
    }

    const { result } = renderHook(() => useWorkspaceFileStore());

    act(() => {
      result.current.loadFileContent('rtl/missing.v');
    });

    expect(result.current.loadErrors['rtl/missing.v']).toBe('Filesystem API unavailable');

    if (window.electronAPI) {
      window.electronAPI.fs = originalFs as typeof window.electronAPI.fs;
    }
  });

  it('stores load failures and clears the loading flag', async () => {
    vi.mocked(window.electronAPI!.fs.readFile).mockRejectedValueOnce(new Error('Read failed'));

    const { result } = renderHook(() => useWorkspaceFileStore());

    act(() => {
      result.current.loadFileContent('rtl/error.v');
    });

    await waitFor(() => {
      expect(result.current.loadErrors['rtl/error.v']).toBe('Read failed');
    });

    expect(result.current.loadingFiles['rtl/error.v']).toBe(false);
    expect(result.current.fileContents['rtl/error.v']).toBeUndefined();
  });

  it('updates cached content locally', () => {
    const { result } = renderHook(() => useWorkspaceFileStore());

    act(() => {
      result.current.updateFileContent('rtl/edit.v', 'initial');
    });

    expect(result.current.fileContents['rtl/edit.v']).toBe('initial');

    act(() => {
      result.current.updateFileContent('rtl/edit.v', 'updated');
    });

    expect(result.current.fileContents['rtl/edit.v']).toBe('updated');
    expect(result.current.dirtyFiles['rtl/edit.v']).toBe(true);
  });

  it('removes cached workspace state for every file under a deleted folder prefix', () => {
    const { result } = renderHook(() => useWorkspaceFileStore());

    act(() => {
      result.current.updateFileContent('rtl/core/reg_file.v', 'module reg_file; endmodule');
      result.current.updateFileContent('rtl/core/alu.v', 'module alu; endmodule');
      result.current.updateFileContent('rtl/peripherals/uart_rx.v', 'module uart_rx; endmodule');
      result.current.removeWorkspacePaths('rtl/core');
    });

    expect(result.current.fileContents['rtl/core/reg_file.v']).toBeUndefined();
    expect(result.current.fileContents['rtl/core/alu.v']).toBeUndefined();
    expect(result.current.fileContents['rtl/peripherals/uart_rx.v']).toBe('module uart_rx; endmodule');
    expect(result.current.dirtyFiles['rtl/core/reg_file.v']).toBeUndefined();
    expect(result.current.dirtyFiles['rtl/core/alu.v']).toBeUndefined();
  });

  it('tracks dirty state across edit, save, and discard operations', async () => {
    vi.mocked(window.electronAPI!.fs.readFile).mockResolvedValueOnce('module edit; endmodule');
    vi.mocked(window.electronAPI!.fs.writeFile).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useWorkspaceFileStore());

    act(() => {
      result.current.loadFileContent('rtl/edit.v');
    });

    await waitFor(() => {
      expect(result.current.fileContents['rtl/edit.v']).toBe('module edit; endmodule');
    });

    act(() => {
      result.current.updateFileContent('rtl/edit.v', 'module edit; logic dirty; endmodule');
    });

    expect(result.current.dirtyFiles['rtl/edit.v']).toBe(true);
    expect(result.current.dirtyFileIds).toContain('rtl/edit.v');

    await act(async () => {
      await result.current.saveFileContent('rtl/edit.v');
    });

    expect(window.electronAPI?.fs.writeFile).toHaveBeenCalledWith('rtl/edit.v', 'module edit; logic dirty; endmodule');
    await waitFor(() => {
      expect(window.electronAPI?.git.getStatus).toHaveBeenCalledTimes(1);
    });
    expect(result.current.dirtyFiles['rtl/edit.v']).toBe(false);

    act(() => {
      result.current.updateFileContent('rtl/edit.v', 'module edit; logic changed_again; endmodule');
      result.current.discardFiles(['rtl/edit.v']);
    });

    expect(result.current.fileContents['rtl/edit.v']).toBe('module edit; logic dirty; endmodule');
    expect(result.current.dirtyFiles['rtl/edit.v']).toBe(false);
  });

  it('returns per-file results when saving multiple files together', async () => {
    vi.mocked(window.electronAPI!.fs.writeFile)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Disk full'));

    const { result } = renderHook(() => useWorkspaceFileStore());

    act(() => {
      result.current.updateFileContent('rtl/pass.v', 'module pass; endmodule');
      result.current.updateFileContent('rtl/fail.v', 'module fail; endmodule');
    });

    let saveResult: Awaited<ReturnType<typeof result.current.saveFiles>> | undefined;

    await act(async () => {
      saveResult = await result.current.saveFiles(['rtl/pass.v', 'rtl/fail.v']);
    });

    expect(saveResult).toEqual({
      savedFileIds: ['rtl/pass.v'],
      failedFileIds: ['rtl/fail.v'],
    });
    await waitFor(() => {
      expect(window.electronAPI?.git.getStatus).toHaveBeenCalledTimes(1);
    });
    expect(result.current.dirtyFiles['rtl/pass.v']).toBe(false);
    expect(result.current.dirtyFiles['rtl/fail.v']).toBe(true);
  });

  it('retains dirty state and exposes save errors when a save fails', async () => {
    vi.mocked(window.electronAPI!.fs.readFile).mockResolvedValueOnce('module fail; endmodule');
    vi.mocked(window.electronAPI!.fs.writeFile).mockRejectedValueOnce(new Error('Disk full'));

    const { result } = renderHook(() => useWorkspaceFileStore());

    act(() => {
      result.current.loadFileContent('rtl/fail.v');
    });

    await waitFor(() => {
      expect(result.current.fileContents['rtl/fail.v']).toBe('module fail; endmodule');
    });

    act(() => {
      result.current.updateFileContent('rtl/fail.v', 'module fail; logic unsaved; endmodule');
    });

    await act(async () => {
      await result.current.saveFileContent('rtl/fail.v');
    });

    expect(result.current.dirtyFiles['rtl/fail.v']).toBe(true);
    expect(result.current.saveErrors['rtl/fail.v']).toBe('Disk full');
    expect(result.current.savingFiles['rtl/fail.v']).toBe(false);
  });
});