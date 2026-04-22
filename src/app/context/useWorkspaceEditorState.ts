import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { focusEditorInstance } from '../editor/focusEditor';

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

interface EditorViewport {
  width: number;
  height: number;
}

function getEditorViewport(element: HTMLElement | null | undefined): EditorViewport | null {
  if (!element) {
    return null;
  }

  const width = element.clientWidth || element.parentElement?.clientWidth || 0;
  const height = element.clientHeight || element.parentElement?.clientHeight || 0;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

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

function renameStoredCursorPositions(
  cursorPositions: StoredCursorPositions,
  currentFileId: string,
  nextFileId: string,
): StoredCursorPositions {
  if (currentFileId === nextFileId) {
    return cursorPositions;
  }

  let changed = false;
  const nextCursorPositions: StoredCursorPositions = { ...cursorPositions };

  Object.entries(cursorPositions).forEach(([groupId, positions]) => {
    const currentPosition = positions[currentFileId];
    if (!currentPosition) {
      return;
    }

    changed = true;
    const nextGroupPositions = { ...positions };
    delete nextGroupPositions[currentFileId];
    nextGroupPositions[nextFileId] = currentPosition;
    nextCursorPositions[groupId] = nextGroupPositions;
  });

  return changed ? nextCursorPositions : cursorPositions;
}

function renameCursorRestoreRequests(
  cursorRestoreRequests: Record<string, CursorRestoreRequest | undefined>,
  currentFileId: string,
  nextFileId: string,
): Record<string, CursorRestoreRequest | undefined> {
  if (currentFileId === nextFileId) {
    return cursorRestoreRequests;
  }

  let changed = false;
  const nextCursorRestoreRequests = { ...cursorRestoreRequests };

  Object.entries(cursorRestoreRequests).forEach(([groupId, request]) => {
    if (!request || request.fileId !== currentFileId) {
      return;
    }

    changed = true;
    nextCursorRestoreRequests[groupId] = {
      ...request,
      fileId: nextFileId,
    };
  });

  return changed ? nextCursorRestoreRequests : cursorRestoreRequests;
}

function renameEditorFileInWorkspace(
  model: EditorWorkspaceModel,
  currentFileId: string,
  nextFileId: string,
  nextFileName: string,
): EditorWorkspaceModel {
  let changed = false;
  const nextGroups = Object.fromEntries(
    Object.entries(model.groups).map(([groupId, group]) => {
      const sourceTab = group.tabs.find((tab) => tab.id === currentFileId);

      if (!sourceTab) {
        return [groupId, group];
      }

      changed = true;

      if (currentFileId === nextFileId) {
        return [
          groupId,
          {
            ...group,
            tabs: group.tabs.map((tab) => (
              tab.id === currentFileId ? { ...tab, name: nextFileName } : tab
            )),
          },
        ];
      }

      const targetTab = group.tabs.find((tab) => tab.id === nextFileId);
      const nextTabs = targetTab
        ? group.tabs
          .filter((tab) => tab.id !== currentFileId)
          .map((tab) => (
            tab.id === nextFileId
              ? {
                  ...tab,
                  isPinned: tab.isPinned || sourceTab.isPinned,
                  name: nextFileName,
                }
              : tab
          ))
        : group.tabs.map((tab) => (
          tab.id === currentFileId
            ? { ...tab, id: nextFileId, name: nextFileName }
            : tab
        ));

      return [
        groupId,
        {
          ...group,
          tabs: nextTabs,
          activeTabId: group.activeTabId === currentFileId ? nextFileId : group.activeTabId,
          previewTabId: group.previewTabId === currentFileId
            ? nextTabs.find((tab) => tab.id === nextFileId && !tab.isPinned)?.id ?? null
            : group.previewTabId,
        },
      ];
    }),
  ) as EditorWorkspaceModel['groups'];

  return changed
    ? {
        ...model,
        groups: nextGroups,
      }
    : model;
}

function findTabGroupId(model: Pick<EditorWorkspaceModel, 'groups' | 'focusedGroupId'>, tabId: string): string | undefined {
  if (model.focusedGroupId && model.groups[model.focusedGroupId]?.tabs.some((tab) => tab.id === tabId)) {
    return model.focusedGroupId;
  }

  return Object.values(model.groups).find((group) => group.tabs.some((tab) => tab.id === tabId))?.id;
}

export function useWorkspaceEditorState() {
  const idCounterRef = useRef(2);
  const untitledIdCounterRef = useRef(1);
  const cursorRestoreTokenRef = useRef(1);
  const [editorState, setEditorState] = useState(() => createInitialEditorWorkspace('group-1'));
  const [jumpToLine, setJumpToLine] = useState<number | undefined>();
  const [cursorPositions, setCursorPositions] = useState<StoredCursorPositions>({});
  const [cursorRestoreRequests, setCursorRestoreRequests] = useState<Record<string, CursorRestoreRequest | undefined>>({});
  const editorRef = useRef<any>(null);
  const editorStateRef = useRef(editorState);
  const cursorPositionsRef = useRef(cursorPositions);
  const cursorRestoreRequestsRef = useRef(cursorRestoreRequests);
  const editorRefsRef = useRef<Record<string, any>>({});
  const relayoutFrameRef = useRef<number | null>(null);

  editorStateRef.current = editorState;
  cursorPositionsRef.current = cursorPositions;
  cursorRestoreRequestsRef.current = cursorRestoreRequests;

  const nextGeneratedId = useCallback((prefix: string) => {
    const id = `${prefix}-${idCounterRef.current}`;
    idCounterRef.current += 1;
    return id;
  }, []);

  const nextUntitledId = useCallback(() => {
    const id = `untitled-${untitledIdCounterRef.current}`;
    untitledIdCounterRef.current += 1;
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

  const relayoutEditors = useCallback((groupIds?: string[]) => {
    const applyRelayout = () => {
      relayoutFrameRef.current = null;

      const editors = (groupIds?.length
        ? groupIds.map((groupId) => editorRefsRef.current[groupId])
        : Object.values(editorRefsRef.current))
        .filter(Boolean);

      editors.forEach((editorInstance) => {
        const domNode = editorInstance.getDomNode?.() as HTMLElement | null | undefined;
        const viewport = getEditorViewport(domNode);

        if (viewport) {
          editorInstance.layout?.(viewport);
          return;
        }

        editorInstance.layout?.();
      });
    };

    if (typeof window === 'undefined' || !('requestAnimationFrame' in window)) {
      applyRelayout();
      return;
    }

    if (relayoutFrameRef.current !== null) {
      window.cancelAnimationFrame(relayoutFrameRef.current);
    }

    relayoutFrameRef.current = window.requestAnimationFrame(applyRelayout);
  }, []);

  useEffect(() => () => {
    if (typeof window === 'undefined' || relayoutFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(relayoutFrameRef.current);
    relayoutFrameRef.current = null;
  }, []);

  const getCursorPositionOrDefault = useCallback((groupId: string, fileId: string): CursorPosition => {
    return getStoredCursorPosition(cursorPositionsRef.current, groupId, fileId) ?? { line: 1, col: 1 };
  }, []);

  const getPreferredEmptyWorkspaceGroupId = useCallback((fileId: string) => {
    const storedGroupId = Object.keys(cursorPositionsRef.current).find((groupId) => Boolean(cursorPositionsRef.current[groupId]?.[fileId]));
    return storedGroupId ?? 'group-1';
  }, []);

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
    const currentState = editorStateRef.current;
    const resolvedGroupId = groupId ?? currentState.focusedGroupId;
    if (!resolvedGroupId) {
      return null;
    }

    const resolvedFileId = fileId ?? currentState.groups[resolvedGroupId]?.activeTabId;
    if (!resolvedFileId) {
      return null;
    }

    const position = getStoredCursorPosition(cursorPositionsRef.current, resolvedGroupId, resolvedFileId) ?? { line: 1, col: 1 };

    return {
      groupId: resolvedGroupId,
      fileId: resolvedFileId,
      line: position.line,
      col: position.col,
    };
  }, []);

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
    const currentState = editorStateRef.current;

    if (currentState.focusedGroupId === groupId) {
      syncEditorRefForGroup(groupId);
      return;
    }

    const activeFileId = currentState.groups[groupId]?.activeTabId;

    setEditorState((current) => focusEditorGroup(current, groupId));
    syncEditorRefForGroup(groupId);

    if (activeFileId) {
      queueStoredCursorRestore(groupId, activeFileId);
    }
  }, [queueStoredCursorRestore, syncEditorRefForGroup]);

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
    const targetGroupId = editorStateRef.current.focusedGroupId ?? getPreferredEmptyWorkspaceGroupId(fileId);

    setEditorState((current) => {
      const baseState = current.groups[targetGroupId]
        ? current
        : createInitialEditorWorkspace(targetGroupId);

      return openFileInEditorGroup(baseState, targetGroupId, fileId, fileName);
    });

    syncEditorRefForGroup(targetGroupId);

    queueStoredCursorRestore(targetGroupId, fileId);
  }, [getPreferredEmptyWorkspaceGroupId, queueStoredCursorRestore, syncEditorRefForGroup]);

  const openUntitledFile = useCallback((groupId?: string) => {
    const untitledId = nextUntitledId();
    const targetGroupId = groupId ?? editorStateRef.current.focusedGroupId ?? 'group-1';

    setEditorState((current) => {
      const baseState = current.groups[targetGroupId]
        ? current
        : createInitialEditorWorkspace(targetGroupId);

      return openFileInEditorGroup(baseState, targetGroupId, untitledId, untitledId);
    });

    syncEditorRefForGroup(targetGroupId);
    queueCursorRestore(targetGroupId, untitledId, { line: 1, col: 1 });

    return untitledId;
  }, [nextUntitledId, queueCursorRestore, syncEditorRefForGroup]);

  const openPreviewFile = useCallback((fileId: string, fileName: string) => {
    const targetGroupId = editorStateRef.current.focusedGroupId ?? getPreferredEmptyWorkspaceGroupId(fileId);

    setEditorState((current) => {
      const baseState = current.groups[targetGroupId]
        ? current
        : createInitialEditorWorkspace(targetGroupId);

      return openFileInEditorGroup(baseState, targetGroupId, fileId, fileName, { preview: true });
    });

    syncEditorRefForGroup(targetGroupId);

    queueStoredCursorRestore(targetGroupId, fileId);
  }, [getPreferredEmptyWorkspaceGroupId, queueStoredCursorRestore, syncEditorRefForGroup]);

  const closeFileInGroup = useCallback((groupId: string, fileId: string) => {
    const nextActiveTabId = getNextActiveTabIdAfterClose(editorStateRef.current.groups[groupId], fileId);

    setEditorState((current) => closeFileInEditorGroup(current, groupId, fileId));

    if (nextActiveTabId) {
      syncEditorRefForGroup(groupId);
      queueStoredCursorRestore(groupId, nextActiveTabId);
    }
  }, [queueStoredCursorRestore, syncEditorRefForGroup]);

  const closeFile = useCallback((fileId: string) => {
    setEditorState((current) => {
      const targetGroupId = findTabGroupId(current, fileId);
      return targetGroupId ? closeFileInEditorGroup(current, targetGroupId, fileId) : current;
    });
  }, []);

  const closeActiveTabInFocusedGroup = useCallback(() => {
    const currentState = editorStateRef.current;
    const groupId = currentState.focusedGroupId;
    if (!groupId) {
      return;
    }

    const activeFileId = currentState.groups[groupId]?.activeTabId;
    if (!activeFileId) {
      return;
    }

    closeFileInGroup(groupId, activeFileId);
  }, [closeFileInGroup]);

  const setActiveTabIdInGroup = useCallback((groupId: string, tabId: string) => {
    setEditorState((current) => setActiveTabInEditorGroup(current, groupId, tabId));
    syncEditorRefForGroup(groupId);

    queueStoredCursorRestore(groupId, tabId);
  }, [queueStoredCursorRestore, syncEditorRefForGroup]);

  const setActiveTabId = useCallback((tabId: string) => {
    const targetGroupId = findTabGroupId(editorStateRef.current, tabId);

    setEditorState((current) => {
      const resolvedTargetGroupId = findTabGroupId(current, tabId);
      return resolvedTargetGroupId ? setActiveTabInEditorGroup(current, resolvedTargetGroupId, tabId) : current;
    });

    if (targetGroupId) {
      syncEditorRefForGroup(targetGroupId);
      queueStoredCursorRestore(targetGroupId, tabId);
    }
  }, [queueStoredCursorRestore, syncEditorRefForGroup]);

  const renameFileId = useCallback((currentFileId: string, nextFileId: string, nextFileName: string) => {
    if (!currentFileId || !nextFileId) {
      return;
    }

    const currentState = editorStateRef.current;
    const targetGroupId = findTabGroupId(currentState, currentFileId) ?? findTabGroupId(currentState, nextFileId);
    const nextPosition = targetGroupId
      ? getStoredCursorPosition(cursorPositionsRef.current, targetGroupId, currentFileId)
        ?? getStoredCursorPosition(cursorPositionsRef.current, targetGroupId, nextFileId)
        ?? { line: 1, col: 1 }
      : { line: 1, col: 1 };

    setEditorState((current) => renameEditorFileInWorkspace(current, currentFileId, nextFileId, nextFileName));
    setCursorPositions((current) => renameStoredCursorPositions(current, currentFileId, nextFileId));
    setCursorRestoreRequests((current) => renameCursorRestoreRequests(current, currentFileId, nextFileId));

    if (targetGroupId) {
      syncEditorRefForGroup(targetGroupId);
      queueCursorRestore(targetGroupId, nextFileId, nextPosition);
    }
  }, [queueCursorRestore, syncEditorRefForGroup]);

  const cycleFocusedGroupTabs = useCallback((direction: EditorTabCycleDirection = 'forward') => {
    const currentState = editorStateRef.current;
    const groupId = currentState.focusedGroupId;
    if (!groupId) {
      return;
    }

    const group = currentState.groups[groupId];
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
  }, [queueStoredCursorRestore, syncEditorRefForGroup]);

  const pinTabInGroup = useCallback((groupId: string, tabId: string) => {
    setEditorState((current) => pinTabInEditorGroup(current, groupId, tabId));
    syncEditorRefForGroup(groupId);
  }, [syncEditorRefForGroup]);

  const pinTab = useCallback((tabId: string) => {
    const targetGroupId = findTabGroupId(editorStateRef.current, tabId);

    setEditorState((current) => {
      const resolvedTargetGroupId = findTabGroupId(current, tabId);
      return resolvedTargetGroupId ? pinTabInEditorGroup(current, resolvedTargetGroupId, tabId) : current;
    });

    if (targetGroupId) {
      syncEditorRefForGroup(targetGroupId);
    }
  }, [syncEditorRefForGroup]);

  const splitGroup = useCallback((groupId: string, direction: 'horizontal' | 'vertical' = 'horizontal') => {
    const newGroupId = nextGeneratedId('group');
    const splitId = nextGeneratedId('split');
    const activeFileId = editorStateRef.current.groups[groupId]?.activeTabId;

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

    relayoutEditors();
  }, [getCursorPositionOrDefault, nextGeneratedId, relayoutEditors]);

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
    const sourceTabCount = editorStateRef.current.groups[sourceGroupId]?.tabs.length ?? 0;
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

    relayoutEditors();
  }, [getCursorPositionOrDefault, nextGeneratedId, relayoutEditors, syncEditorRefForGroup]);

  const jumpTo = useCallback((line: number) => {
    setJumpToLine(line);
    setTimeout(() => setJumpToLine(undefined), 100);
  }, []);

  const setCursorPos = useCallback((line: number, col: number, groupId?: string, fileId?: string) => {
    const currentState = editorStateRef.current;
    const resolvedGroupId = groupId ?? currentState.focusedGroupId ?? 'group-1';
    const resolvedFileId = fileId ?? currentState.groups[resolvedGroupId]?.activeTabId;

    if (!resolvedFileId) {
      return;
    }

    setCursorPositions((current) => upsertStoredCursorPosition(current, resolvedGroupId, resolvedFileId, { line, col }));
  }, []);

  const registerEditorRef = useCallback((groupId: string, editorInstance: any) => {
    editorRefsRef.current[groupId] = editorInstance;
    if (editorStateRef.current.focusedGroupId === groupId) {
      editorRef.current = editorInstance;
    }
  }, []);

  const syncFocusedEditorRef = useCallback(() => {
    const focusedGroupId = editorStateRef.current.focusedGroupId;

    if (focusedGroupId) {
      syncEditorRefForGroup(focusedGroupId);
    }
  }, [syncEditorRefForGroup]);

  const focusActiveEditor = useCallback((groupId?: string) => {
    const resolvedGroupId = groupId ?? editorStateRef.current.focusedGroupId;
    if (!resolvedGroupId) {
      return;
    }

    syncEditorRefForGroup(resolvedGroupId);
    focusEditorInstance(editorRefsRef.current[resolvedGroupId]);
  }, [syncEditorRefForGroup]);

  const getCursorRestoreRequest = useCallback((groupId: string) => cursorRestoreRequestsRef.current[groupId], []);

  const getStoredCursorPositionForGroup = useCallback(
    (groupId: string, fileId: string) => getStoredCursorPosition(cursorPositionsRef.current, groupId, fileId),
    [],
  );

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
    getCursorRestoreRequest,
    getStoredCursorPosition: getStoredCursorPositionForGroup,
    jumpTo,
    jumpToLine,
    moveTab,
    openFile,
    openFileInGroup,
    openUntitledFile,
    openPreviewFile,
    openPreviewFileInGroup,
    pinTab,
    pinTabInGroup,
    renameFileId,
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