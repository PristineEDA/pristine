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
  });
});