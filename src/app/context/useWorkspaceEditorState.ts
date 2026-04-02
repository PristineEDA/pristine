import { useCallback, useMemo, useRef, useState } from 'react';
import {
  createInitialEditorWorkspace,
  focusEditorGroup,
  moveEditorTab,
  openFileInEditorGroup,
  pinTabInEditorGroup,
  setActiveTabInEditorGroup,
  closeFileInEditorGroup,
  splitEditorGroup,
  type EditorDropPosition,
} from '../editor/editorLayout';

export function useWorkspaceEditorState() {
  const idCounterRef = useRef(2);
  const [editorState, setEditorState] = useState(() => createInitialEditorWorkspace('group-1'));
  const [jumpToLine, setJumpToLine] = useState<number | undefined>();
  const [cursorPositions, setCursorPositions] = useState<Record<string, { line: number; col: number }>>({});
  const editorRef = useRef<any>(null);
  const editorRefsRef = useRef<Record<string, any>>({});

  const nextGeneratedId = useCallback((prefix: string) => {
    const id = `${prefix}-${idCounterRef.current}`;
    idCounterRef.current += 1;
    return id;
  }, []);

  const focusedGroup = editorState.focusedGroupId ? editorState.groups[editorState.focusedGroupId] : null;
  const tabs = focusedGroup?.tabs ?? [];
  const activeTabId = focusedGroup?.activeTabId ?? '';
  const editorGroups = useMemo(() => Object.values(editorState.groups), [editorState.groups]);
  const cursorLine = editorState.focusedGroupId ? cursorPositions[editorState.focusedGroupId]?.line ?? 1 : 1;
  const cursorCol = editorState.focusedGroupId ? cursorPositions[editorState.focusedGroupId]?.col ?? 1 : 1;

  const focusGroup = useCallback((groupId: string) => {
    setEditorState((current) => focusEditorGroup(current, groupId));
    if (editorRefsRef.current[groupId]) {
      editorRef.current = editorRefsRef.current[groupId];
    }
  }, []);

  const openFileInGroup = useCallback((fileId: string, fileName: string, groupId: string) => {
    setEditorState((current) => openFileInEditorGroup(current, groupId, fileId, fileName));
  }, []);

  const openPreviewFileInGroup = useCallback((fileId: string, fileName: string, groupId: string) => {
    setEditorState((current) => openFileInEditorGroup(current, groupId, fileId, fileName, { preview: true }));
  }, []);

  const openFile = useCallback((fileId: string, fileName: string) => {
    setEditorState((current) => {
      const targetGroupId = current.focusedGroupId ?? nextGeneratedId('group');
      const baseState = current.groups[targetGroupId]
        ? current
        : createInitialEditorWorkspace(targetGroupId);

      return openFileInEditorGroup(baseState, targetGroupId, fileId, fileName);
    });
  }, [nextGeneratedId]);

  const openPreviewFile = useCallback((fileId: string, fileName: string) => {
    setEditorState((current) => {
      const targetGroupId = current.focusedGroupId ?? nextGeneratedId('group');
      const baseState = current.groups[targetGroupId]
        ? current
        : createInitialEditorWorkspace(targetGroupId);

      return openFileInEditorGroup(baseState, targetGroupId, fileId, fileName, { preview: true });
    });
  }, [nextGeneratedId]);

  const closeFileInGroup = useCallback((groupId: string, fileId: string) => {
    setEditorState((current) => closeFileInEditorGroup(current, groupId, fileId));
  }, []);

  const closeFile = useCallback((fileId: string) => {
    setEditorState((current) => {
      const targetGroupId = current.focusedGroupId && current.groups[current.focusedGroupId]?.tabs.some((tab) => tab.id === fileId)
        ? current.focusedGroupId
        : Object.values(current.groups).find((group) => group.tabs.some((tab) => tab.id === fileId))?.id;

      return targetGroupId ? closeFileInEditorGroup(current, targetGroupId, fileId) : current;
    });
  }, []);

  const setActiveTabIdInGroup = useCallback((groupId: string, id: string) => {
    setEditorState((current) => setActiveTabInEditorGroup(current, groupId, id));
    focusGroup(groupId);
  }, [focusGroup]);

  const setActiveTabId = useCallback((id: string) => {
    setEditorState((current) => {
      const targetGroupId = current.focusedGroupId ?? Object.values(current.groups).find((group) => group.tabs.some((tab) => tab.id === id))?.id;
      return targetGroupId ? setActiveTabInEditorGroup(current, targetGroupId, id) : current;
    });
  }, []);

  const pinTabInGroup = useCallback((groupId: string, tabId: string) => {
    setEditorState((current) => pinTabInEditorGroup(current, groupId, tabId));
    focusGroup(groupId);
  }, [focusGroup]);

  const pinTab = useCallback((tabId: string) => {
    setEditorState((current) => {
      const targetGroupId = current.focusedGroupId && current.groups[current.focusedGroupId]?.tabs.some((tab) => tab.id === tabId)
        ? current.focusedGroupId
        : Object.values(current.groups).find((group) => group.tabs.some((tab) => tab.id === tabId))?.id;

      return targetGroupId ? pinTabInEditorGroup(current, targetGroupId, tabId) : current;
    });
  }, []);

  const splitGroup = useCallback((groupId: string, direction: 'horizontal' | 'vertical' = 'horizontal') => {
    setEditorState((current) => splitEditorGroup(
      current,
      groupId,
      nextGeneratedId('group'),
      nextGeneratedId('split'),
      direction,
    ));
  }, [nextGeneratedId]);

  const moveTab = useCallback((sourceGroupId: string, tabId: string, targetGroupId: string, position: EditorDropPosition) => {
    setEditorState((current) => moveEditorTab(
      current,
      sourceGroupId,
      tabId,
      targetGroupId,
      position,
      nextGeneratedId('group'),
      nextGeneratedId('split'),
    ));
  }, [nextGeneratedId]);

  const jumpTo = useCallback((line: number) => {
    setJumpToLine(line);
    setTimeout(() => setJumpToLine(undefined), 100);
  }, []);

  const setCursorPos = useCallback((line: number, col: number, groupId?: string) => {
    setCursorPositions((current) => ({
      ...current,
      [(groupId ?? editorState.focusedGroupId ?? 'group-1')]: { line, col },
    }));
  }, [editorState.focusedGroupId]);

  const registerEditorRef = useCallback((groupId: string, editorInstance: any) => {
    editorRefsRef.current[groupId] = editorInstance;
    if (editorState.focusedGroupId === groupId) {
      editorRef.current = editorInstance;
    }
  }, [editorState.focusedGroupId]);

  const syncFocusedEditorRef = useCallback(() => {
    if (editorState.focusedGroupId && editorRefsRef.current[editorState.focusedGroupId]) {
      editorRef.current = editorRefsRef.current[editorState.focusedGroupId];
    }
  }, [editorState.focusedGroupId]);

  return {
    activeTabId,
    cursorCol,
    cursorLine,
    editorGroups,
    editorLayout: editorState.layout,
    editorRef,
    focusGroup,
    focusedGroupId: editorState.focusedGroupId,
    jumpTo,
    jumpToLine,
    moveTab,
    openFile,
    openFileInGroup,
    openPreviewFile,
    openPreviewFileInGroup,
    pinTab,
    pinTabInGroup,
    closeFile,
    closeFileInGroup,
    registerEditorRef,
    setActiveTabId,
    setActiveTabIdInGroup,
    setCursorPos,
    splitGroup,
    syncFocusedEditorRef,
    tabs,
  };
}