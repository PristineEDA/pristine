import { useCallback, useMemo, useRef, useState } from 'react';
import {
  createInitialEditorWorkspace,
  focusEditorGroup,
  getCycledTabIdInEditorGroup,
  getNextActiveTabIdAfterClose,
  moveEditorTab,
  openFileInEditorGroup,
  pinTabInEditorGroup,
  setActiveTabInEditorGroup,
  closeFileInEditorGroup,
  splitEditorGroup,
  type EditorTabCycleDirection,
  type EditorDropPosition,
  type EditorWorkspaceModel,
} from '../editor/editorLayout';

interface CursorPosition {
  line: number;
  col: number;
}

export interface EditorSelectionSnapshot extends CursorPosition {
  groupId: string;
  fileId: string;
}

export interface CursorRestoreRequest extends EditorSelectionSnapshot {
  token: number;
}

type StoredCursorPositions = Record<string, Record<string, CursorPosition>>;

function getStoredCursorPosition(
  cursorPositions: StoredCursorPositions,
  groupId?: string | null,
  fileId?: string | null,
): CursorPosition | undefined {
  if (!groupId || !fileId) {
    return undefined;
  }

  return cursorPositions[groupId]?.[fileId];
}

function upsertStoredCursorPosition(
  cursorPositions: StoredCursorPositions,
  groupId: string,
  fileId: string,
  position: CursorPosition,
): StoredCursorPositions {
  return {
    ...cursorPositions,
    [groupId]: {
      ...cursorPositions[groupId],
      [fileId]: position,
    },
  };
}

function removeStoredCursorPosition(
  cursorPositions: StoredCursorPositions,
  groupId: string,
  fileId: string,
): StoredCursorPositions {
  const groupPositions = cursorPositions[groupId];
  if (!groupPositions?.[fileId]) {
    return cursorPositions;
  }

  const nextGroupPositions = { ...groupPositions };
  delete nextGroupPositions[fileId];

  if (Object.keys(nextGroupPositions).length === 0) {
    const nextCursorPositions = { ...cursorPositions };
    delete nextCursorPositions[groupId];
    return nextCursorPositions;
  }

  return {
    ...cursorPositions,
    [groupId]: nextGroupPositions,
  };
}

function findTabGroupId(model: Pick<EditorWorkspaceModel, 'groups' | 'focusedGroupId'>, tabId: string): string | undefined {
  if (model.focusedGroupId && model.groups[model.focusedGroupId]?.tabs.some((tab) => tab.id === tabId)) {
    return model.focusedGroupId;
  }

  return Object.values(model.groups).find((group) => group.tabs.some((tab) => tab.id === tabId))?.id;
}

export function useWorkspaceEditorState() {
  const idCounterRef = useRef(2);
  const cursorRestoreTokenRef = useRef(1);
  const [editorState, setEditorState] = useState(() => createInitialEditorWorkspace('group-1'));
  const [jumpToLine, setJumpToLine] = useState<number | undefined>();
  const [cursorPositions, setCursorPositions] = useState<StoredCursorPositions>({});
  const [cursorRestoreRequests, setCursorRestoreRequests] = useState<Record<string, CursorRestoreRequest | undefined>>({});
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
  const activeCursorPosition = getStoredCursorPosition(cursorPositions, editorState.focusedGroupId, activeTabId);
  const cursorLine = activeCursorPosition?.line ?? 1;
  const cursorCol = activeCursorPosition?.col ?? 1;

  const syncEditorRefForGroup = useCallback((groupId: string) => {
    if (editorRefsRef.current[groupId]) {
      editorRef.current = editorRefsRef.current[groupId];
    }
  }, []);

  const getCursorPositionOrDefault = useCallback((groupId: string, fileId: string): CursorPosition => {
    return getStoredCursorPosition(cursorPositions, groupId, fileId) ?? { line: 1, col: 1 };
  }, [cursorPositions]);

  const getPreferredEmptyWorkspaceGroupId = useCallback((fileId: string) => {
    const storedGroupId = Object.keys(cursorPositions).find((groupId) => Boolean(cursorPositions[groupId]?.[fileId]));
    return storedGroupId ?? 'group-1';
  }, [cursorPositions]);

  const queueCursorRestore = useCallback((groupId: string, fileId: string, position: CursorPosition) => {
    setCursorPositions((current) => upsertStoredCursorPosition(current, groupId, fileId, position));
    setCursorRestoreRequests((current) => ({
      ...current,
      [groupId]: {
        groupId,
        fileId,
        line: position.line,
        col: position.col,
        token: cursorRestoreTokenRef.current++,
      },
    }));
  }, []);

  const queueStoredCursorRestore = useCallback((groupId: string, fileId: string) => {
    queueCursorRestore(groupId, fileId, getCursorPositionOrDefault(groupId, fileId));
  }, [getCursorPositionOrDefault, queueCursorRestore]);

  const clearCursorRestoreRequest = useCallback((groupId: string, token: number) => {
    setCursorRestoreRequests((current) => {
      const request = current[groupId];
      if (!request || request.token !== token) {
        return current;
      }

      const nextRequests = { ...current };
      delete nextRequests[groupId];
      return nextRequests;
    });
  }, []);

  const captureEditorSelectionSnapshot = useCallback((groupId?: string, fileId?: string): EditorSelectionSnapshot | null => {
    const resolvedGroupId = groupId ?? editorState.focusedGroupId;
    if (!resolvedGroupId) {
      return null;
    }

    const resolvedFileId = fileId ?? editorState.groups[resolvedGroupId]?.activeTabId;
    if (!resolvedFileId) {
      return null;
    }

    const position = getStoredCursorPosition(cursorPositions, resolvedGroupId, resolvedFileId) ?? { line: 1, col: 1 };

    return {
      groupId: resolvedGroupId,
      fileId: resolvedFileId,
      line: position.line,
      col: position.col,
    };
  }, [cursorPositions, editorState.focusedGroupId, editorState.groups]);

  const restoreEditorSelection = useCallback((snapshot: EditorSelectionSnapshot) => {
    setEditorState((current) => {
      const group = current.groups[snapshot.groupId];
      if (!group) {
        return current;
      }

      const focusedState = focusEditorGroup(current, snapshot.groupId);
      if (!group.tabs.some((tab) => tab.id === snapshot.fileId)) {
        return focusedState;
      }

      return setActiveTabInEditorGroup(focusedState, snapshot.groupId, snapshot.fileId);
    });

    syncEditorRefForGroup(snapshot.groupId);
    queueCursorRestore(snapshot.groupId, snapshot.fileId, {
      line: snapshot.line,
      col: snapshot.col,
    });
  }, [queueCursorRestore, syncEditorRefForGroup]);

  const focusGroup = useCallback((groupId: string) => {
    if (editorState.focusedGroupId === groupId) {
      syncEditorRefForGroup(groupId);
      return;
    }

    const activeFileId = editorState.groups[groupId]?.activeTabId;

    setEditorState((current) => focusEditorGroup(current, groupId));
    syncEditorRefForGroup(groupId);

    if (activeFileId) {
      queueStoredCursorRestore(groupId, activeFileId);
    }
  }, [editorState.focusedGroupId, editorState.groups, queueStoredCursorRestore, syncEditorRefForGroup]);

  const openFileInGroup = useCallback((fileId: string, fileName: string, groupId: string) => {
    setEditorState((current) => openFileInEditorGroup(current, groupId, fileId, fileName));
    syncEditorRefForGroup(groupId);

    queueStoredCursorRestore(groupId, fileId);
  }, [queueStoredCursorRestore, syncEditorRefForGroup]);

  const openPreviewFileInGroup = useCallback((fileId: string, fileName: string, groupId: string) => {
    setEditorState((current) => openFileInEditorGroup(current, groupId, fileId, fileName, { preview: true }));
    syncEditorRefForGroup(groupId);

    queueStoredCursorRestore(groupId, fileId);
  }, [queueStoredCursorRestore, syncEditorRefForGroup]);

  const openFile = useCallback((fileId: string, fileName: string) => {
    const targetGroupId = editorState.focusedGroupId ?? getPreferredEmptyWorkspaceGroupId(fileId);

    setEditorState((current) => {
      const baseState = current.groups[targetGroupId]
        ? current
        : createInitialEditorWorkspace(targetGroupId);

      return openFileInEditorGroup(baseState, targetGroupId, fileId, fileName);
    });

    syncEditorRefForGroup(targetGroupId);

    queueStoredCursorRestore(targetGroupId, fileId);
  }, [editorState.focusedGroupId, getPreferredEmptyWorkspaceGroupId, queueStoredCursorRestore, syncEditorRefForGroup]);

  const openPreviewFile = useCallback((fileId: string, fileName: string) => {
    const targetGroupId = editorState.focusedGroupId ?? getPreferredEmptyWorkspaceGroupId(fileId);

    setEditorState((current) => {
      const baseState = current.groups[targetGroupId]
        ? current
        : createInitialEditorWorkspace(targetGroupId);

      return openFileInEditorGroup(baseState, targetGroupId, fileId, fileName, { preview: true });
    });

    syncEditorRefForGroup(targetGroupId);

    queueStoredCursorRestore(targetGroupId, fileId);
  }, [editorState.focusedGroupId, getPreferredEmptyWorkspaceGroupId, queueStoredCursorRestore, syncEditorRefForGroup]);

  const closeFileInGroup = useCallback((groupId: string, fileId: string) => {
    const nextActiveTabId = getNextActiveTabIdAfterClose(editorState.groups[groupId], fileId);

    setEditorState((current) => closeFileInEditorGroup(current, groupId, fileId));

    if (nextActiveTabId) {
      syncEditorRefForGroup(groupId);
      queueStoredCursorRestore(groupId, nextActiveTabId);
    }
  }, [editorState.groups, queueStoredCursorRestore, syncEditorRefForGroup]);

  const closeFile = useCallback((fileId: string) => {
    setEditorState((current) => {
      const targetGroupId = findTabGroupId(current, fileId);
      return targetGroupId ? closeFileInEditorGroup(current, targetGroupId, fileId) : current;
    });
  }, []);

  const closeActiveTabInFocusedGroup = useCallback(() => {
    const groupId = editorState.focusedGroupId;
    if (!groupId) {
      return;
    }

    const activeFileId = editorState.groups[groupId]?.activeTabId;
    if (!activeFileId) {
      return;
    }

    closeFileInGroup(groupId, activeFileId);
  }, [closeFileInGroup, editorState.focusedGroupId, editorState.groups]);

  const setActiveTabIdInGroup = useCallback((groupId: string, tabId: string) => {
    setEditorState((current) => setActiveTabInEditorGroup(current, groupId, tabId));
    syncEditorRefForGroup(groupId);

    queueStoredCursorRestore(groupId, tabId);
  }, [queueStoredCursorRestore, syncEditorRefForGroup]);

  const setActiveTabId = useCallback((tabId: string) => {
    const targetGroupId = findTabGroupId(editorState, tabId);

    setEditorState((current) => {
      const resolvedTargetGroupId = findTabGroupId(current, tabId);
      return resolvedTargetGroupId ? setActiveTabInEditorGroup(current, resolvedTargetGroupId, tabId) : current;
    });

    if (targetGroupId) {
      syncEditorRefForGroup(targetGroupId);
      queueStoredCursorRestore(targetGroupId, tabId);
    }
  }, [editorState, queueStoredCursorRestore, syncEditorRefForGroup]);

  const cycleFocusedGroupTabs = useCallback((direction: EditorTabCycleDirection = 'forward') => {
    const groupId = editorState.focusedGroupId;
    if (!groupId) {
      return;
    }

    const group = editorState.groups[groupId];
    const nextTabId = getCycledTabIdInEditorGroup(group, direction);
    if (!nextTabId || nextTabId === group?.activeTabId) {
      return;
    }

    setEditorState((current) => {
      const currentGroup = current.groups[groupId];
      const resolvedNextTabId = getCycledTabIdInEditorGroup(currentGroup, direction);
      return resolvedNextTabId ? setActiveTabInEditorGroup(current, groupId, resolvedNextTabId) : current;
    });

    syncEditorRefForGroup(groupId);
    queueStoredCursorRestore(groupId, nextTabId);
  }, [editorState.focusedGroupId, editorState.groups, queueStoredCursorRestore, syncEditorRefForGroup]);

  const pinTabInGroup = useCallback((groupId: string, tabId: string) => {
    setEditorState((current) => pinTabInEditorGroup(current, groupId, tabId));
    syncEditorRefForGroup(groupId);
  }, [syncEditorRefForGroup]);

  const pinTab = useCallback((tabId: string) => {
    const targetGroupId = findTabGroupId(editorState, tabId);

    setEditorState((current) => {
      const resolvedTargetGroupId = findTabGroupId(current, tabId);
      return resolvedTargetGroupId ? pinTabInEditorGroup(current, resolvedTargetGroupId, tabId) : current;
    });

    if (targetGroupId) {
      syncEditorRefForGroup(targetGroupId);
    }
  }, [editorState, syncEditorRefForGroup]);

  const splitGroup = useCallback((groupId: string, direction: 'horizontal' | 'vertical' = 'horizontal') => {
    const newGroupId = nextGeneratedId('group');
    const splitId = nextGeneratedId('split');
    const activeFileId = editorState.groups[groupId]?.activeTabId;

    setEditorState((current) => splitEditorGroup(
      current,
      groupId,
      newGroupId,
      splitId,
      direction,
    ));

    if (activeFileId) {
      setCursorPositions((current) => upsertStoredCursorPosition(
        current,
        newGroupId,
        activeFileId,
        getCursorPositionOrDefault(groupId, activeFileId),
      ));
    }
  }, [editorState.groups, getCursorPositionOrDefault, nextGeneratedId]);

  const moveTab = useCallback((sourceGroupId: string, tabId: string, targetGroupId: string, position: EditorDropPosition) => {
    const newGroupId = nextGeneratedId('group');
    const splitId = nextGeneratedId('split');

    if (position === 'center' && sourceGroupId === targetGroupId) {
      setEditorState((current) => moveEditorTab(
        current,
        sourceGroupId,
        tabId,
        targetGroupId,
        position,
        newGroupId,
        splitId,
      ));
      syncEditorRefForGroup(targetGroupId);
      return;
    }

    const sourcePosition = getCursorPositionOrDefault(sourceGroupId, tabId);
    const sourceTabCount = editorState.groups[sourceGroupId]?.tabs.length ?? 0;
    const shouldDuplicate = position !== 'center' && sourceGroupId === targetGroupId && sourceTabCount === 1;
    const destinationGroupId = position === 'center' ? targetGroupId : newGroupId;

    setEditorState((current) => moveEditorTab(
      current,
      sourceGroupId,
      tabId,
      targetGroupId,
      position,
      newGroupId,
      splitId,
    ));

    setCursorPositions((current) => {
      const basePositions = shouldDuplicate
        ? current
        : removeStoredCursorPosition(current, sourceGroupId, tabId);

      return upsertStoredCursorPosition(basePositions, destinationGroupId, tabId, sourcePosition);
    });
  }, [editorState.groups, getCursorPositionOrDefault, nextGeneratedId, syncEditorRefForGroup]);

  const jumpTo = useCallback((line: number) => {
    setJumpToLine(line);
    setTimeout(() => setJumpToLine(undefined), 100);
  }, []);

  const setCursorPos = useCallback((line: number, col: number, groupId?: string, fileId?: string) => {
    const resolvedGroupId = groupId ?? editorState.focusedGroupId ?? 'group-1';
    const resolvedFileId = fileId ?? editorState.groups[resolvedGroupId]?.activeTabId;

    if (!resolvedFileId) {
      return;
    }

    setCursorPositions((current) => upsertStoredCursorPosition(current, resolvedGroupId, resolvedFileId, { line, col }));
  }, [editorState.focusedGroupId, editorState.groups]);

  const registerEditorRef = useCallback((groupId: string, editorInstance: any) => {
    editorRefsRef.current[groupId] = editorInstance;
    if (editorState.focusedGroupId === groupId) {
      editorRef.current = editorInstance;
    }
  }, [editorState.focusedGroupId]);

  const syncFocusedEditorRef = useCallback(() => {
    if (editorState.focusedGroupId) {
      syncEditorRefForGroup(editorState.focusedGroupId);
    }
  }, [editorState.focusedGroupId, syncEditorRefForGroup]);

  const focusActiveEditor = useCallback((groupId?: string) => {
    const resolvedGroupId = groupId ?? editorState.focusedGroupId;
    if (!resolvedGroupId) {
      return;
    }

    syncEditorRefForGroup(resolvedGroupId);
    editorRefsRef.current[resolvedGroupId]?.focus?.();
    editorRefsRef.current[resolvedGroupId]?.getDomNode?.()?.focus?.();
  }, [editorState.focusedGroupId, syncEditorRefForGroup]);

  return {
    activeTabId,
    captureEditorSelectionSnapshot,
    clearCursorRestoreRequest,
    cursorCol,
    cursorLine,
    cycleFocusedGroupTabs,
    editorGroups,
    editorLayout: editorState.layout,
    editorRef,
    closeActiveTabInFocusedGroup,
    focusGroup,
    focusActiveEditor,
    focusedGroupId: editorState.focusedGroupId,
    getCursorRestoreRequest: (groupId: string) => cursorRestoreRequests[groupId],
    getStoredCursorPosition: (groupId: string, fileId: string) => getStoredCursorPosition(cursorPositions, groupId, fileId),
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
    restoreEditorSelection,
    setActiveTabId,
    setActiveTabIdInGroup,
    setCursorPos,
    splitGroup,
    syncFocusedEditorRef,
    tabs,
  };
}