import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  type EditorTabCycleDirection,
  type EditorDropPosition,
  type EditorGroup,
  type EditorLayoutNode,
  type EditorTab,
} from '../editor/editorLayout';
import {
  canToggleLayoutPanels,
  type CodeView,
  DEFAULT_PANEL_STATE_BY_CODE_VIEW,
  EMPTY_PANEL_STATE,
  type MainContentView,
  type PanelVisibilityState,
} from '../codeViewPanels';
import {
  useWorkspaceEditorState,
  type CursorRestoreRequest,
  type EditorSelectionSnapshot,
} from './useWorkspaceEditorState';
import { useWorkspaceFileStore, type SaveFilesResult } from './useWorkspaceFileStore';
import type { WindowCloseRequest } from '../window/windowClose';

// ─── Types ──────────────────────────────────────────────────────────────────

export type Tab = EditorTab;

type UnsavedChangesDialogKind = 'close-app' | 'close-file' | 'review';

export interface UnsavedChangesDialogState {
  fileIds: string[];
  kind: UnsavedChangesDialogKind;
  title: string;
  description: string;
}

interface WorkspaceState {
  activeView: CodeView;
  setActiveView: (view: CodeView) => void;

  mainContentView: MainContentView;
  setMainContentView: (view: MainContentView) => void;
  canToggleLayoutPanels: boolean;

  editorGroups: EditorGroup[];
  editorLayout: EditorLayoutNode | null;
  focusedGroupId: string | null;
  focusGroup: (groupId: string) => void;
  focusActiveEditor: (groupId?: string) => void;
  splitGroup: (groupId: string, direction?: 'horizontal' | 'vertical') => void;
  moveTab: (sourceGroupId: string, tabId: string, targetGroupId: string, position: EditorDropPosition) => void;
  cycleFocusedGroupTabs: (direction?: EditorTabCycleDirection) => void;
  closeActiveTabInFocusedGroup: () => void;

  tabs: Tab[];
  activeTabId: string;
  openFile: (fileId: string, fileName: string) => void;
  openFileInGroup: (fileId: string, fileName: string, groupId: string) => void;
  openPreviewFile: (fileId: string, fileName: string) => void;
  openPreviewFileInGroup: (fileId: string, fileName: string, groupId: string) => void;
  pinTab: (tabId: string) => void;
  pinTabInGroup: (groupId: string, tabId: string) => void;
  closeFile: (fileId: string) => void;
  closeFileInGroup: (groupId: string, fileId: string) => void;
  setActiveTabId: (id: string) => void;
  setActiveTabIdInGroup: (groupId: string, id: string) => void;

  jumpToLine: number | undefined;
  jumpTo: (line: number) => void;

  cursorLine: number;
  cursorCol: number;
  setCursorPos: (line: number, col: number, groupId?: string, fileId?: string) => void;
  getStoredCursorPosition: (groupId: string, fileId: string) => { line: number; col: number } | undefined;
  getCursorRestoreRequest: (groupId: string) => CursorRestoreRequest | undefined;
  clearCursorRestoreRequest: (groupId: string, token: number) => void;
  captureEditorSelectionSnapshot: (groupId?: string, fileId?: string) => EditorSelectionSnapshot | null;
  restoreEditorSelection: (snapshot: EditorSelectionSnapshot) => void;

  showLeftPanel: boolean;
  setShowLeftPanel: (show: boolean) => void;
  showBottomPanel: boolean;
  setShowBottomPanel: (show: boolean) => void;
  showRightPanel: boolean;
  setShowRightPanel: (show: boolean) => void;

  fileContents: Record<string, string>;
  loadingFiles: Record<string, boolean>;
  loadErrors: Record<string, string>;
  loadFileContent: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  updateFileContentInGroup: (groupId: string, fileId: string, content: string) => void;
  dirtyFiles: Record<string, boolean>;
  dirtyFileIds: string[];
  savingFiles: Record<string, boolean>;
  saveErrors: Record<string, string>;
  saveActiveFile: () => Promise<boolean>;
  saveAllFiles: () => Promise<boolean>;
  saveFiles: (fileIds: string[]) => Promise<SaveFilesResult>;
  undoActiveEditor: () => Promise<boolean>;
  redoActiveEditor: () => Promise<boolean>;

  unsavedChangesDialog: UnsavedChangesDialogState | null;
  openUnsavedChangesDialog: (fileIds?: string[]) => void;
  confirmUnsavedChangesSave: (fileIds?: string[]) => Promise<void>;
  discardUnsavedChanges: (fileIds?: string[]) => void;
  cancelUnsavedChanges: () => void;

  editorRef: React.MutableRefObject<any>;
  registerEditorRef: (groupId: string, editorInstance: any) => void;
}

function getFileBaseName(fileId: string): string {
  const normalized = fileId.replace(/\\/g, '/');
  const segments = normalized.split('/');
  return segments[segments.length - 1] ?? fileId;
}

function createUnsavedChangesDialogState(
  kind: UnsavedChangesDialogKind,
  fileIds: string[],
  getTabName: (fileId: string) => string,
): UnsavedChangesDialogState {
  if (kind === 'close-app') {
    return {
      fileIds,
      kind,
      title: 'Save changes before closing Pristine?',
      description: `You have ${fileIds.length} file${fileIds.length === 1 ? '' : 's'} with unsaved changes.`,
    };
  }

  if (kind === 'review') {
    return {
      fileIds,
      kind,
      title: 'Unsaved Files',
      description: fileIds.length === 1
        ? `The file ${getTabName(fileIds[0] ?? '')} has unsaved changes.`
        : `${fileIds.length} files have unsaved changes. Choose which files to save now.`,
    };
  }

  return {
    fileIds,
    kind,
    title: 'Save changes before closing?',
    description: fileIds.length === 1
      ? `The file ${getTabName(fileIds[0] ?? '')} has unsaved changes.`
      : `${fileIds.length} files have unsaved changes.`,
  };
}

const EMPTY_TABS: Tab[] = [];
const EMPTY_EDITOR_GROUPS: EditorGroup[] = [];

function withModifiedTabState(tab: EditorTab, dirtyFiles: Record<string, boolean>, previousTab?: EditorTab): EditorTab {
  const modified = Boolean(dirtyFiles[tab.id]);

  if (
    previousTab
    && previousTab.id === tab.id
    && previousTab.name === tab.name
    && previousTab.isPinned === tab.isPinned
    && previousTab.modified === modified
  ) {
    return previousTab;
  }

  return {
    ...tab,
    modified,
  };
}

function withModifiedTabsState(
  tabs: EditorTab[],
  dirtyFiles: Record<string, boolean>,
  previousTabs: EditorTab[] = EMPTY_TABS,
): EditorTab[] {
  const previousTabsById = new Map(previousTabs.map((tab) => [tab.id, tab]));
  let changed = tabs.length !== previousTabs.length;

  const nextTabs = tabs.map((tab, index) => {
    const nextTab = withModifiedTabState(tab, dirtyFiles, previousTabsById.get(tab.id));

    if (!changed && nextTab !== previousTabs[index]) {
      changed = true;
    }

    return nextTab;
  });

  return changed ? nextTabs : previousTabs;
}

function withModifiedEditorGroupsState(
  groups: EditorGroup[],
  dirtyFiles: Record<string, boolean>,
  previousGroups: EditorGroup[],
): EditorGroup[] {
  const previousGroupsById = new Map(previousGroups.map((group) => [group.id, group]));
  let changed = groups.length !== previousGroups.length;

  const nextGroups = groups.map((group, index) => {
    const previousGroup = previousGroupsById.get(group.id);
    const nextTabs = withModifiedTabsState(group.tabs, dirtyFiles, previousGroup?.tabs);

    if (
      previousGroup
      && previousGroup.activeTabId === group.activeTabId
      && previousGroup.previewTabId === group.previewTabId
      && nextTabs === previousGroup.tabs
    ) {
      if (!changed && previousGroup !== previousGroups[index]) {
        changed = true;
      }

      return previousGroup;
    }

    changed = true;
    return {
      ...group,
      tabs: nextTabs,
    };
  });

  return changed ? nextGroups : previousGroups;
}

// ─── Context ────────────────────────────────────────────────────────────────

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<CodeView>('explorer');
  const [mainContentView, setMainContentView] = useState<MainContentView>('code');
  const [panelStateByView, setPanelStateByView] = useState<Record<CodeView, PanelVisibilityState>>({
    ...DEFAULT_PANEL_STATE_BY_CODE_VIEW,
  });
  const editorWorkspace = useWorkspaceEditorState();
  const fileStore = useWorkspaceFileStore();
  const [unsavedChangesDialog, setUnsavedChangesDialog] = useState<UnsavedChangesDialogState | null>(null);
  const unsavedChangesResolverRef = useRef<((result: 'save' | 'discard' | 'cancel') => void) | null>(null);
  const previousEditorGroupsRef = useRef<EditorGroup[]>(EMPTY_EDITOR_GROUPS);
  const layoutPanelsEnabled = canToggleLayoutPanels(mainContentView, activeView);
  const visiblePanelState = layoutPanelsEnabled ? panelStateByView[activeView] : EMPTY_PANEL_STATE;
  const editorWorkspaceRef = useRef(editorWorkspace);
  const fileStoreRef = useRef(fileStore);
  const activeViewRef = useRef(activeView);
  const layoutPanelsEnabledRef = useRef(layoutPanelsEnabled);
  const unsavedChangesDialogRef = useRef(unsavedChangesDialog);

  editorWorkspaceRef.current = editorWorkspace;
  fileStoreRef.current = fileStore;
  activeViewRef.current = activeView;
  layoutPanelsEnabledRef.current = layoutPanelsEnabled;
  unsavedChangesDialogRef.current = unsavedChangesDialog;

  const findTabName = useCallback((fileId: string) => {
    for (const group of editorWorkspaceRef.current.editorGroups) {
      const tab = group.tabs.find((currentTab) => currentTab.id === fileId);
      if (tab) {
        return tab.name;
      }
    }

    return getFileBaseName(fileId);
  }, []);

  const editorGroups = useMemo(() => {
    const nextGroups = withModifiedEditorGroupsState(
      editorWorkspace.editorGroups,
      fileStore.dirtyFiles,
      previousEditorGroupsRef.current,
    );

    previousEditorGroupsRef.current = nextGroups;
    return nextGroups;
  }, [editorWorkspace.editorGroups, fileStore.dirtyFiles]);

  const tabs = useMemo(
    () => editorGroups.find((group) => group.id === editorWorkspace.focusedGroupId)?.tabs ?? EMPTY_TABS,
    [editorGroups, editorWorkspace.focusedGroupId],
  );

  const getDirtyRequestedFileIds = useCallback((fileIds: string[]) => Array.from(
    new Set(fileIds.filter((fileId) => fileStoreRef.current.dirtyFiles[fileId])),
  ), []);

  const showUnsavedChangesDialog = useCallback((fileIds: string[], kind: UnsavedChangesDialogKind) => {
    const uniqueFileIds = getDirtyRequestedFileIds(fileIds);
    if (uniqueFileIds.length === 0) {
      setUnsavedChangesDialog(null);
      return null;
    }

    const nextState = createUnsavedChangesDialogState(kind, uniqueFileIds, findTabName);
    setUnsavedChangesDialog(nextState);
    return nextState;
  }, [findTabName, getDirtyRequestedFileIds]);

  const requestUnsavedChangesConfirmation = useCallback((fileIds: string[], kind: UnsavedChangesDialogKind) => {
    if (unsavedChangesResolverRef.current) {
      unsavedChangesResolverRef.current('cancel');
    }

    const dialogState = showUnsavedChangesDialog(fileIds, kind);
    if (!dialogState) {
      return Promise.resolve<'save' | 'discard' | 'cancel'>('save');
    }

    return new Promise<'save' | 'discard' | 'cancel'>((resolve) => {
      unsavedChangesResolverRef.current = resolve;
    });
  }, [showUnsavedChangesDialog]);

  const resolveUnsavedChangesDialog = useCallback((result: 'save' | 'discard' | 'cancel') => {
    const resolver = unsavedChangesResolverRef.current;
    unsavedChangesResolverRef.current = null;
    setUnsavedChangesDialog(null);
    resolver?.(result);
  }, []);

  const saveFiles = useCallback((fileIds: string[]) => {
    return fileStoreRef.current.saveFiles(fileIds);
  }, []);

  const saveAllFiles = useCallback(async () => {
    const { dirtyFileIds, saveFiles: saveWorkspaceFiles } = fileStoreRef.current;
    const result = await saveWorkspaceFiles(dirtyFileIds);
    return result.failedFileIds.length === 0;
  }, []);

  const saveActiveFile = useCallback(async () => {
    const { activeTabId } = editorWorkspaceRef.current;
    const { loadingFiles, loadErrors, saveFileContent } = fileStoreRef.current;

    if (!activeTabId || loadingFiles[activeTabId] || loadErrors[activeTabId]) {
      return false;
    }

    return (await saveFileContent(activeTabId)) === true;
  }, []);

  const runActiveEditorAction = useCallback(async (actionId: 'undo' | 'redo') => {
    const editor = editorWorkspaceRef.current.editorRef.current;
    if (!editor) {
      return false;
    }

    const action = editor.getAction?.(actionId);
    if (action?.run) {
      await action.run();
      return true;
    }

    if (typeof editor.trigger === 'function') {
      editor.trigger('pristine', actionId, null);
      return true;
    }

    return false;
  }, []);

  const updateFileContentInGroup = useCallback((groupId: string, fileId: string, content: string) => {
    const group = editorWorkspaceRef.current.editorGroups.find((currentGroup) => currentGroup.id === groupId);
    if (group?.previewTabId === fileId) {
      editorWorkspaceRef.current.pinTabInGroup(groupId, fileId);
    }

    fileStoreRef.current.updateFileContent(fileId, content);
  }, []);

  const maybeProceedWithUnsavedChanges = useCallback(async (
    fileIds: string[],
    kind: UnsavedChangesDialogKind,
    onProceed: () => void | Promise<void>,
  ) => {
    const dirtyFileIds = getDirtyRequestedFileIds(fileIds);
    if (dirtyFileIds.length === 0) {
      await onProceed();
      return true;
    }

    const decision = await requestUnsavedChangesConfirmation(dirtyFileIds, kind);
    if (decision === 'cancel') {
      return false;
    }

    await onProceed();
    return true;
  }, [getDirtyRequestedFileIds, requestUnsavedChangesConfirmation]);

  const closeFileInGroup = useCallback((groupId: string, fileId: string) => {
    void maybeProceedWithUnsavedChanges(
      [fileId],
      'close-file',
      () => {
        editorWorkspaceRef.current.closeFileInGroup(groupId, fileId);
      },
    );
  }, [maybeProceedWithUnsavedChanges]);

  const closeFile = useCallback((fileId: string) => {
    void maybeProceedWithUnsavedChanges(
      [fileId],
      'close-file',
      () => {
        editorWorkspaceRef.current.closeFile(fileId);
      },
    );
  }, [maybeProceedWithUnsavedChanges]);

  const closeActiveTabInFocusedGroup = useCallback(() => {
    const { editorGroups, focusedGroupId } = editorWorkspaceRef.current;
    const groupId = focusedGroupId;
    if (!groupId) {
      return;
    }

    const activeFileId = editorGroups.find((group) => group.id === groupId)?.activeTabId;
    if (!activeFileId) {
      return;
    }

    closeFileInGroup(groupId, activeFileId);
  }, [closeFileInGroup]);

  const openUnsavedChangesDialog = useCallback((fileIds?: string[]) => {
    showUnsavedChangesDialog(fileIds ?? fileStoreRef.current.dirtyFileIds, 'review');
  }, [showUnsavedChangesDialog]);

  const confirmUnsavedChangesSave = useCallback(async (selectedFileIds?: string[]) => {
    const dialogState = unsavedChangesDialogRef.current;
    const fileIds = dialogState?.fileIds ?? [];
    if (fileIds.length === 0 || !dialogState) {
      resolveUnsavedChangesDialog('cancel');
      return;
    }

    const targetFileIds = Array.from(new Set((selectedFileIds ?? fileIds).filter((fileId) => fileIds.includes(fileId))));
    if (targetFileIds.length === 0) {
      return;
    }

    const saveResult = await fileStoreRef.current.saveFiles(targetFileIds);
    const remainingFileIds = getDirtyRequestedFileIds(
      fileIds.filter((fileId) => !saveResult.savedFileIds.includes(fileId)),
    );
    if (remainingFileIds.length > 0) {
      setUnsavedChangesDialog(createUnsavedChangesDialogState(dialogState.kind, remainingFileIds, findTabName));
      return;
    }

    resolveUnsavedChangesDialog('save');
  }, [findTabName, getDirtyRequestedFileIds, resolveUnsavedChangesDialog]);

  const discardUnsavedChanges = useCallback((selectedFileIds?: string[]) => {
    const dialogState = unsavedChangesDialogRef.current;
    const fileIds = dialogState?.fileIds ?? [];
    if (fileIds.length === 0 || !dialogState) {
      resolveUnsavedChangesDialog('discard');
      return;
    }

    const targetFileIds = Array.from(new Set((selectedFileIds ?? fileIds).filter((fileId) => fileIds.includes(fileId))));
    if (targetFileIds.length === 0) {
      return;
    }

    fileStoreRef.current.discardFiles(targetFileIds);

    const discardedFileIdSet = new Set(targetFileIds);
    const remainingFileIds = getDirtyRequestedFileIds(
      fileIds.filter((fileId) => !discardedFileIdSet.has(fileId)),
    );
    if (remainingFileIds.length > 0) {
      setUnsavedChangesDialog(createUnsavedChangesDialogState(dialogState.kind, remainingFileIds, findTabName));
      return;
    }

    resolveUnsavedChangesDialog('discard');
  }, [findTabName, getDirtyRequestedFileIds, resolveUnsavedChangesDialog]);

  const cancelUnsavedChanges = useCallback(() => {
    resolveUnsavedChangesDialog('cancel');
  }, [resolveUnsavedChangesDialog]);

  useEffect(() => {
    const electronApi = window.electronAPI;
    if (!electronApi?.onCloseRequested) {
      return undefined;
    }

    const dispose = electronApi.onCloseRequested((request: WindowCloseRequest) => {
      void (async () => {
        const dirtyFileIds = fileStoreRef.current.dirtyFileIds;
        if (dirtyFileIds.length === 0) {
          await electronApi.resolveCloseRequest(request.requestId, 'proceed');
          return;
        }

        const decision = await requestUnsavedChangesConfirmation(dirtyFileIds, 'close-app');

        if (decision === 'cancel') {
          await electronApi.resolveCloseRequest(request.requestId, 'cancel');
          return;
        }

        await electronApi.resolveCloseRequest(request.requestId, 'proceed');
      })();
    });

    return () => {
      dispose?.();
    };
  }, [requestUnsavedChangesConfirmation]);

  const setPanelStateForActiveView = useCallback((nextState: Partial<PanelVisibilityState>) => {
    if (!layoutPanelsEnabledRef.current) {
      return;
    }

    setPanelStateByView((currentState) => {
      const view = activeViewRef.current;
      const currentPanelState = currentState[view];
      const nextPanelState = {
        ...currentPanelState,
        ...nextState,
      };

      if (
        currentPanelState.showLeftPanel === nextPanelState.showLeftPanel
        && currentPanelState.showBottomPanel === nextPanelState.showBottomPanel
        && currentPanelState.showRightPanel === nextPanelState.showRightPanel
      ) {
        return currentState;
      }

      return {
        ...currentState,
        [view]: nextPanelState,
      };
    });
  }, []);

  const setShowLeftPanel = useCallback((show: boolean) => {
    setPanelStateForActiveView({ showLeftPanel: show });
  }, [setPanelStateForActiveView]);

  const setShowBottomPanel = useCallback((show: boolean) => {
    setPanelStateForActiveView({ showBottomPanel: show });
  }, [setPanelStateForActiveView]);

  const setShowRightPanel = useCallback((show: boolean) => {
    setPanelStateForActiveView({ showRightPanel: show });
  }, [setPanelStateForActiveView]);

  const undoActiveEditor = useCallback(() => runActiveEditorAction('undo'), [runActiveEditorAction]);

  const redoActiveEditor = useCallback(() => runActiveEditorAction('redo'), [runActiveEditorAction]);

  useEffect(() => {
    editorWorkspace.syncFocusedEditorRef();
  }, [editorWorkspace.syncFocusedEditorRef]);

  return (
    <WorkspaceContext.Provider value={{
      activeView, setActiveView,
      mainContentView, setMainContentView,
      canToggleLayoutPanels: layoutPanelsEnabled,
      editorGroups,
      editorLayout: editorWorkspace.editorLayout,
      focusedGroupId: editorWorkspace.focusedGroupId,
      focusGroup: editorWorkspace.focusGroup,
      focusActiveEditor: editorWorkspace.focusActiveEditor,
      splitGroup: editorWorkspace.splitGroup,
      moveTab: editorWorkspace.moveTab,
      cycleFocusedGroupTabs: editorWorkspace.cycleFocusedGroupTabs,
      closeActiveTabInFocusedGroup,
      tabs,
      activeTabId: editorWorkspace.activeTabId,
      openFile: editorWorkspace.openFile,
      openFileInGroup: editorWorkspace.openFileInGroup,
      openPreviewFile: editorWorkspace.openPreviewFile,
      openPreviewFileInGroup: editorWorkspace.openPreviewFileInGroup,
      pinTab: editorWorkspace.pinTab,
      pinTabInGroup: editorWorkspace.pinTabInGroup,
      closeFile,
      closeFileInGroup,
      setActiveTabId: editorWorkspace.setActiveTabId,
      setActiveTabIdInGroup: editorWorkspace.setActiveTabIdInGroup,
      jumpToLine: editorWorkspace.jumpToLine,
      jumpTo: editorWorkspace.jumpTo,
      cursorLine: editorWorkspace.cursorLine,
      cursorCol: editorWorkspace.cursorCol,
      setCursorPos: editorWorkspace.setCursorPos,
      getStoredCursorPosition: editorWorkspace.getStoredCursorPosition,
      getCursorRestoreRequest: editorWorkspace.getCursorRestoreRequest,
      clearCursorRestoreRequest: editorWorkspace.clearCursorRestoreRequest,
      captureEditorSelectionSnapshot: editorWorkspace.captureEditorSelectionSnapshot,
      restoreEditorSelection: editorWorkspace.restoreEditorSelection,
      showLeftPanel: visiblePanelState.showLeftPanel,
      setShowLeftPanel,
      showBottomPanel: visiblePanelState.showBottomPanel,
      setShowBottomPanel,
      showRightPanel: visiblePanelState.showRightPanel,
      setShowRightPanel,
      dirtyFiles: fileStore.dirtyFiles,
      dirtyFileIds: fileStore.dirtyFileIds,
      fileContents: fileStore.fileContents,
      loadingFiles: fileStore.loadingFiles,
      loadErrors: fileStore.loadErrors,
      loadFileContent: fileStore.loadFileContent,
      updateFileContent: fileStore.updateFileContent,
      updateFileContentInGroup,
      savingFiles: fileStore.savingFiles,
      saveErrors: fileStore.saveErrors,
      saveActiveFile,
      saveAllFiles,
      saveFiles,
      undoActiveEditor,
      redoActiveEditor,
      unsavedChangesDialog,
      openUnsavedChangesDialog,
      confirmUnsavedChangesSave,
      discardUnsavedChanges,
      cancelUnsavedChanges,
      editorRef: editorWorkspace.editorRef,
      registerEditorRef: editorWorkspace.registerEditorRef,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
