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
import { useWorkspaceFileStore } from './useWorkspaceFileStore';
import type { WindowCloseRequest } from '../window/windowClose';

// ─── Types ──────────────────────────────────────────────────────────────────

export type Tab = EditorTab;

export interface UnsavedChangesDialogState {
  fileIds: string[];
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
  saveFiles: (fileIds: string[]) => Promise<boolean>;
  undoActiveEditor: () => Promise<boolean>;
  redoActiveEditor: () => Promise<boolean>;

  unsavedChangesDialog: UnsavedChangesDialogState | null;
  confirmUnsavedChangesSave: () => Promise<void>;
  discardUnsavedChanges: () => void;
  cancelUnsavedChanges: () => void;

  editorRef: React.MutableRefObject<any>;
  registerEditorRef: (groupId: string, editorInstance: any) => void;
}

function getFileBaseName(fileId: string): string {
  const normalized = fileId.replace(/\\/g, '/');
  const segments = normalized.split('/');
  return segments[segments.length - 1] ?? fileId;
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
  const layoutPanelsEnabled = canToggleLayoutPanels(mainContentView, activeView);
  const visiblePanelState = layoutPanelsEnabled ? panelStateByView[activeView] : EMPTY_PANEL_STATE;

  const findTabName = useCallback((fileId: string) => {
    for (const group of editorWorkspace.editorGroups) {
      const tab = group.tabs.find((currentTab) => currentTab.id === fileId);
      if (tab) {
        return tab.name;
      }
    }

    return getFileBaseName(fileId);
  }, [editorWorkspace.editorGroups]);

  const tabs = useMemo(
    () => editorWorkspace.tabs.map((tab) => ({ ...tab, modified: fileStore.dirtyFiles[tab.id] })),
    [editorWorkspace.tabs, fileStore.dirtyFiles],
  );

  const editorGroups = useMemo(
    () => editorWorkspace.editorGroups.map((group) => ({
      ...group,
      tabs: group.tabs.map((tab) => ({ ...tab, modified: fileStore.dirtyFiles[tab.id] })),
    })),
    [editorWorkspace.editorGroups, fileStore.dirtyFiles],
  );

  const requestUnsavedChangesConfirmation = useCallback((fileIds: string[], options?: {
    title?: string;
    description?: string;
  }) => {
    const uniqueFileIds = Array.from(new Set(fileIds.filter((fileId) => fileStore.dirtyFiles[fileId])));
    if (uniqueFileIds.length === 0) {
      return Promise.resolve<'save' | 'discard' | 'cancel'>('save');
    }

    if (unsavedChangesResolverRef.current) {
      unsavedChangesResolverRef.current('cancel');
    }

    const title = options?.title ?? (uniqueFileIds.length === 1 ? 'Save changes before closing?' : 'Save changes before continuing?');
    const description = options?.description
      ?? (uniqueFileIds.length === 1
        ? `The file ${findTabName(uniqueFileIds[0] ?? '')} has unsaved changes.`
        : `${uniqueFileIds.length} files have unsaved changes.`);

    setUnsavedChangesDialog({
      fileIds: uniqueFileIds,
      title,
      description,
    });

    return new Promise<'save' | 'discard' | 'cancel'>((resolve) => {
      unsavedChangesResolverRef.current = resolve;
    });
  }, [fileStore.dirtyFiles, findTabName]);

  const resolveUnsavedChangesDialog = useCallback((result: 'save' | 'discard' | 'cancel') => {
    const resolver = unsavedChangesResolverRef.current;
    unsavedChangesResolverRef.current = null;
    setUnsavedChangesDialog(null);
    resolver?.(result);
  }, []);

  const saveFiles = useCallback((fileIds: string[]) => {
    return fileStore.saveFiles(fileIds);
  }, [fileStore]);

  const saveActiveFile = useCallback(async () => {
    const activeFileId = editorWorkspace.activeTabId;
    if (!activeFileId || fileStore.loadingFiles[activeFileId] || fileStore.loadErrors[activeFileId]) {
      return false;
    }

    return (await fileStore.saveFileContent(activeFileId)) === true;
  }, [editorWorkspace.activeTabId, fileStore]);

  const runActiveEditorAction = useCallback(async (actionId: 'undo' | 'redo') => {
    const editor = editorWorkspace.editorRef.current;
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
  }, [editorWorkspace.editorRef]);

  const updateFileContentInGroup = useCallback((groupId: string, fileId: string, content: string) => {
    const group = editorWorkspace.editorGroups.find((currentGroup) => currentGroup.id === groupId);
    if (group?.previewTabId === fileId) {
      editorWorkspace.pinTabInGroup(groupId, fileId);
    }

    fileStore.updateFileContent(fileId, content);
  }, [editorWorkspace, fileStore]);

  const maybeProceedWithUnsavedChanges = useCallback(async (
    fileIds: string[],
    options: { title?: string; description?: string },
    onProceed: () => void | Promise<void>,
  ) => {
    const dirtyFileIds = Array.from(new Set(fileIds.filter((fileId) => fileStore.dirtyFiles[fileId])));
    if (dirtyFileIds.length === 0) {
      await onProceed();
      return true;
    }

    const decision = await requestUnsavedChangesConfirmation(dirtyFileIds, options);
    if (decision === 'cancel') {
      return false;
    }

    await onProceed();
    return true;
  }, [fileStore, requestUnsavedChangesConfirmation]);

  const closeFileInGroup = useCallback((groupId: string, fileId: string) => {
    void maybeProceedWithUnsavedChanges(
      [fileId],
      {
        title: 'Save changes before closing?',
        description: `The file ${findTabName(fileId)} has unsaved changes.`,
      },
      () => {
        editorWorkspace.closeFileInGroup(groupId, fileId);
      },
    );
  }, [editorWorkspace, findTabName, maybeProceedWithUnsavedChanges]);

  const closeFile = useCallback((fileId: string) => {
    void maybeProceedWithUnsavedChanges(
      [fileId],
      {
        title: 'Save changes before closing?',
        description: `The file ${findTabName(fileId)} has unsaved changes.`,
      },
      () => {
        editorWorkspace.closeFile(fileId);
      },
    );
  }, [editorWorkspace, findTabName, maybeProceedWithUnsavedChanges]);

  const closeActiveTabInFocusedGroup = useCallback(() => {
    const groupId = editorWorkspace.focusedGroupId;
    if (!groupId) {
      return;
    }

    const activeFileId = editorWorkspace.editorGroups.find((group) => group.id === groupId)?.activeTabId;
    if (!activeFileId) {
      return;
    }

    closeFileInGroup(groupId, activeFileId);
  }, [closeFileInGroup, editorWorkspace.editorGroups, editorWorkspace.focusedGroupId]);

  const confirmUnsavedChangesSave = useCallback(async () => {
    const fileIds = unsavedChangesDialog?.fileIds ?? [];
    if (fileIds.length === 0) {
      resolveUnsavedChangesDialog('cancel');
      return;
    }

    const saveSucceeded = await fileStore.saveFiles(fileIds);
    if (!saveSucceeded) {
      return;
    }

    resolveUnsavedChangesDialog('save');
  }, [fileStore, resolveUnsavedChangesDialog, unsavedChangesDialog?.fileIds]);

  const discardUnsavedChanges = useCallback(() => {
    const fileIds = unsavedChangesDialog?.fileIds ?? [];
    if (fileIds.length > 0) {
      fileStore.discardFiles(fileIds);
    }

    resolveUnsavedChangesDialog('discard');
  }, [fileStore, resolveUnsavedChangesDialog, unsavedChangesDialog?.fileIds]);

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
        const dirtyFileIds = fileStore.dirtyFileIds;
        if (dirtyFileIds.length === 0) {
          await electronApi.resolveCloseRequest(request.requestId, 'proceed');
          return;
        }

        const decision = await requestUnsavedChangesConfirmation(dirtyFileIds, {
          title: 'Save changes before closing Pristine?',
          description: `You have ${dirtyFileIds.length} file${dirtyFileIds.length === 1 ? '' : 's'} with unsaved changes.`,
        });

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
  }, [fileStore, requestUnsavedChangesConfirmation]);

  const setPanelStateForActiveView = (nextState: Partial<PanelVisibilityState>) => {
    if (!layoutPanelsEnabled) {
      return;
    }

    setPanelStateByView((currentState) => ({
      ...currentState,
      [activeView]: {
        ...currentState[activeView],
        ...nextState,
      },
    }));
  };

  useEffect(() => {
    editorWorkspace.syncFocusedEditorRef();
  }, [editorWorkspace]);

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
      setShowLeftPanel: (show) => setPanelStateForActiveView({ showLeftPanel: show }),
      showBottomPanel: visiblePanelState.showBottomPanel,
      setShowBottomPanel: (show) => setPanelStateForActiveView({ showBottomPanel: show }),
      showRightPanel: visiblePanelState.showRightPanel,
      setShowRightPanel: (show) => setPanelStateForActiveView({ showRightPanel: show }),
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
      saveFiles,
      undoActiveEditor: () => runActiveEditorAction('undo'),
      redoActiveEditor: () => runActiveEditorAction('redo'),
      unsavedChangesDialog,
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
