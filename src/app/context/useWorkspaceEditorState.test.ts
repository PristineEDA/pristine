import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWorkspaceEditorState } from './useWorkspaceEditorState';

describe('useWorkspaceEditorState', () => {
  it('creates untitled files in the focused editor group with sequential names and initial cursor restore', () => {
    const { result } = renderHook(() => useWorkspaceEditorState());

    let firstUntitledId = '';
    let secondUntitledId = '';

    act(() => {
      firstUntitledId = result.current.openUntitledFile();
    });

    expect(firstUntitledId).toBe('untitled-1');
    expect(result.current.activeTabId).toBe('untitled-1');
    expect(result.current.tabs.map((tab) => tab.id)).toEqual(['untitled-1']);
    expect(result.current.getCursorRestoreRequest('group-1')).toEqual(
      expect.objectContaining({
        fileId: 'untitled-1',
        groupId: 'group-1',
        line: 1,
        col: 1,
      }),
    );

    act(() => {
      result.current.openFile('rtl/core/reg_file.v', 'reg_file.v');
      result.current.splitGroup('group-1', 'horizontal');
    });

    act(() => {
      secondUntitledId = result.current.openUntitledFile();
    });

    expect(secondUntitledId).toBe('untitled-2');
    expect(result.current.focusedGroupId).toBe('group-2');
    expect(result.current.activeTabId).toBe('untitled-2');
    expect(result.current.editorGroups.find((group) => group.id === 'group-2')?.tabs.map((tab) => tab.id)).toContain('untitled-2');
  });

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

  it('cycles focused-group tabs to the right by default and supports reverse cycling', () => {
    const { result } = renderHook(() => useWorkspaceEditorState());

    act(() => {
      result.current.openFile('README.md', 'README.md');
    });

    act(() => {
      result.current.setCursorPos(4, 2);
    });

    act(() => {
      result.current.openFile('rtl/core/reg_file.v', 'reg_file.v');
    });

    act(() => {
      result.current.setCursorPos(9, 6);
    });

    act(() => {
      result.current.openFile('.gitignore', '.gitignore');
    });

    act(() => {
      result.current.setCursorPos(12, 7);
    });

    act(() => {
      result.current.cycleFocusedGroupTabs();
    });

    expect(result.current.activeTabId).toBe('README.md');
    expect(result.current.getCursorRestoreRequest('group-1')).toEqual(
      expect.objectContaining({
        groupId: 'group-1',
        fileId: 'README.md',
        line: 4,
        col: 2,
        token: expect.any(Number),
      }),
    );

    act(() => {
      result.current.cycleFocusedGroupTabs('backward');
    });

    expect(result.current.activeTabId).toBe('.gitignore');
    expect(result.current.getCursorRestoreRequest('group-1')).toEqual(
      expect.objectContaining({
        groupId: 'group-1',
        fileId: '.gitignore',
        line: 12,
        col: 7,
        token: expect.any(Number),
      }),
    );
  });

  it('closes the active tab in the focused group and restores the next tab cursor snapshot', () => {
    const { result } = renderHook(() => useWorkspaceEditorState());

    act(() => {
      result.current.openFile('README.md', 'README.md');
    });

    act(() => {
      result.current.setCursorPos(7, 4);
    });

    act(() => {
      result.current.openFile('rtl/core/reg_file.v', 'reg_file.v');
    });

    act(() => {
      result.current.setCursorPos(15, 3);
    });

    act(() => {
      result.current.closeActiveTabInFocusedGroup();
    });

    expect(result.current.activeTabId).toBe('README.md');
    expect(result.current.tabs.map((tab) => tab.id)).toEqual(['README.md']);
    expect(result.current.getCursorRestoreRequest('group-1')).toEqual(
      expect.objectContaining({
        groupId: 'group-1',
        fileId: 'README.md',
        line: 7,
        col: 4,
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

  it('keeps core editor actions stable across workspace state updates', () => {
    const { result } = renderHook(() => useWorkspaceEditorState());

    const initialActions = {
      openFile: result.current.openFile,
      openPreviewFile: result.current.openPreviewFile,
      focusGroup: result.current.focusGroup,
      closeActiveTabInFocusedGroup: result.current.closeActiveTabInFocusedGroup,
      setActiveTabId: result.current.setActiveTabId,
      cycleFocusedGroupTabs: result.current.cycleFocusedGroupTabs,
      splitGroup: result.current.splitGroup,
      moveTab: result.current.moveTab,
      setCursorPos: result.current.setCursorPos,
      getStoredCursorPosition: result.current.getStoredCursorPosition,
      getCursorRestoreRequest: result.current.getCursorRestoreRequest,
      syncFocusedEditorRef: result.current.syncFocusedEditorRef,
      focusActiveEditor: result.current.focusActiveEditor,
      registerEditorRef: result.current.registerEditorRef,
    };

    act(() => {
      result.current.openFile('README.md', 'README.md');
      result.current.setCursorPos(4, 2);
      result.current.splitGroup('group-1', 'horizontal');
      result.current.focusGroup('group-1');
      result.current.openPreviewFile('rtl/core/reg_file.v', 'reg_file.v');
      result.current.cycleFocusedGroupTabs('forward');
    });

    expect(result.current.openFile).toBe(initialActions.openFile);
    expect(result.current.openPreviewFile).toBe(initialActions.openPreviewFile);
    expect(result.current.focusGroup).toBe(initialActions.focusGroup);
    expect(result.current.closeActiveTabInFocusedGroup).toBe(initialActions.closeActiveTabInFocusedGroup);
    expect(result.current.setActiveTabId).toBe(initialActions.setActiveTabId);
    expect(result.current.cycleFocusedGroupTabs).toBe(initialActions.cycleFocusedGroupTabs);
    expect(result.current.splitGroup).toBe(initialActions.splitGroup);
    expect(result.current.moveTab).toBe(initialActions.moveTab);
    expect(result.current.setCursorPos).toBe(initialActions.setCursorPos);
    expect(result.current.getStoredCursorPosition).toBe(initialActions.getStoredCursorPosition);
    expect(result.current.getCursorRestoreRequest).toBe(initialActions.getCursorRestoreRequest);
    expect(result.current.syncFocusedEditorRef).toBe(initialActions.syncFocusedEditorRef);
    expect(result.current.focusActiveEditor).toBe(initialActions.focusActiveEditor);
    expect(result.current.registerEditorRef).toBe(initialActions.registerEditorRef);
  });
});