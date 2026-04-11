import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWorkspaceEditorState } from './useWorkspaceEditorState';

describe('useWorkspaceEditorState', () => {
  it('tracks cursor positions separately for the same file in different editor groups', () => {
    const { result } = renderHook(() => useWorkspaceEditorState());

    act(() => {
      result.current.openFile('rtl/core/reg_file.v', 'reg_file.v');
    });

    act(() => {
      result.current.setCursorPos(8, 5);
    });

    act(() => {
      result.current.splitGroup('group-1', 'horizontal');
    });

    expect(result.current.focusedGroupId).toBe('group-2');
    expect(result.current.getStoredCursorPosition('group-2', 'rtl/core/reg_file.v')).toEqual({ line: 8, col: 5 });

    act(() => {
      result.current.setCursorPos(21, 2, 'group-2', 'rtl/core/reg_file.v');
    });

    act(() => {
      result.current.focusGroup('group-1');
    });

    expect(result.current.cursorLine).toBe(8);
    expect(result.current.cursorCol).toBe(5);

    act(() => {
      result.current.focusGroup('group-2');
    });

    expect(result.current.cursorLine).toBe(21);
    expect(result.current.cursorCol).toBe(2);
  });

  it('preserves a file cursor position when the tab is closed and reopened in the same group', () => {
    const { result } = renderHook(() => useWorkspaceEditorState());

    act(() => {
      result.current.openFile('rtl/core/reg_file.v', 'reg_file.v');
    });

    act(() => {
      result.current.setCursorPos(11, 4);
    });

    act(() => {
      result.current.closeFile('rtl/core/reg_file.v');
    });

    expect(result.current.activeTabId).toBe('');

    act(() => {
      result.current.openFile('rtl/core/reg_file.v', 'reg_file.v');
    });

    expect(result.current.activeTabId).toBe('rtl/core/reg_file.v');
    expect(result.current.getStoredCursorPosition('group-1', 'rtl/core/reg_file.v')).toEqual({ line: 11, col: 4 });
    expect(result.current.captureEditorSelectionSnapshot()).toEqual({
      groupId: 'group-1',
      fileId: 'rtl/core/reg_file.v',
      line: 11,
      col: 4,
    });
  });

  it('creates an explicit cursor restore request from a captured editor selection snapshot', () => {
    const { result } = renderHook(() => useWorkspaceEditorState());

    act(() => {
      result.current.openFile('rtl/core/reg_file.v', 'reg_file.v');
    });

    act(() => {
      result.current.setCursorPos(9, 3);
    });

    const snapshot = result.current.captureEditorSelectionSnapshot();
    expect(snapshot).toEqual({
      groupId: 'group-1',
      fileId: 'rtl/core/reg_file.v',
      line: 9,
      col: 3,
    });

    act(() => {
      result.current.restoreEditorSelection(snapshot!);
    });

    expect(result.current.getCursorRestoreRequest('group-1')).toEqual(
      expect.objectContaining({
        groupId: 'group-1',
        fileId: 'rtl/core/reg_file.v',
        line: 9,
        col: 3,
        token: expect.any(Number),
      }),
    );
  });

  it('queues explicit cursor restores when opening a new file and when reactivating a remembered tab', () => {
    const { result } = renderHook(() => useWorkspaceEditorState());

    act(() => {
      result.current.openFile('rtl/core/reg_file.v', 'reg_file.v');
    });

    const initialRequest = result.current.getCursorRestoreRequest('group-1');
    expect(initialRequest).toEqual(
      expect.objectContaining({
        groupId: 'group-1',
        fileId: 'rtl/core/reg_file.v',
        line: 1,
        col: 1,
        token: expect.any(Number),
      }),
    );

    act(() => {
      result.current.clearCursorRestoreRequest('group-1', initialRequest!.token);
      result.current.setCursorPos(6, 8, 'group-1', 'rtl/core/reg_file.v');
      result.current.openFile('README.md', 'README.md');
    });

    const readmeRequest = result.current.getCursorRestoreRequest('group-1');
    expect(readmeRequest).toEqual(
      expect.objectContaining({
        groupId: 'group-1',
        fileId: 'README.md',
        line: 1,
        col: 1,
        token: expect.any(Number),
      }),
    );

    act(() => {
      result.current.clearCursorRestoreRequest('group-1', readmeRequest!.token);
      result.current.setActiveTabId('rtl/core/reg_file.v');
    });

    expect(result.current.getCursorRestoreRequest('group-1')).toEqual(
      expect.objectContaining({
        groupId: 'group-1',
        fileId: 'rtl/core/reg_file.v',
        line: 6,
        col: 8,
        token: expect.any(Number),
      }),
    );
  });

  it('focuses the registered editor for the active group', () => {
    const { result } = renderHook(() => useWorkspaceEditorState());
    const focus = vi.fn();

    act(() => {
      result.current.registerEditorRef('group-1', { focus });
      result.current.openFile('rtl/core/reg_file.v', 'reg_file.v');
    });

    act(() => {
      result.current.focusActiveEditor();
    });

    expect(focus).toHaveBeenCalledTimes(1);
  });
});