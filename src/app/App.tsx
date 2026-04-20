import { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { MenuBar } from './components/code/shared/MenuBar';
import { DeleteConfirmationDialog } from './components/code/shared/DeleteConfirmationDialog';
import { UnsavedChangesDialog } from './components/code/shared/UnsavedChangesDialog';
import { ActivityBar } from './components/code/shared/ActivityBar';
import { LeftSidePanel } from './components/code/explorer/LeftSidePanel';
import { EditorSplitLayout } from './components/code/shared/EditorSplitLayout';
import { RightSidePanel } from './components/code/explorer/RightSidePanel';
import { BottomPanel } from './components/code/explorer/BottomPanel';
import { CodeWorkspaceShell, EXPLORER_LEFT_PANEL_DEFAULT_WIDTH_PX } from './components/code/shared/CodeWorkspaceShell';
import { AppStatusBar } from './components/code/shared/statusBars/AppStatusBar';
import { QuickOpenPalette } from './components/code/shared/QuickOpenPalette';
import { createQuickOpenFileEntries, getRecentQuickOpenFiles, searchQuickOpenFiles, type QuickOpenFileEntry, type QuickOpenSearchResult } from './quickOpen/quickOpenSearch';
import type { WorkspaceRevealRequest } from './workspace/useWorkspaceTree';
import { isMonacoTextInputFocused } from './editor/focusEditor';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import type { EditorSelectionSnapshot } from './context/useWorkspaceEditorState';
import { SidebarProvider } from './components/ui/sidebar';
import { refreshWorkspaceGitStatus } from './git/workspaceGitStatus';
import { useGlobalAppShortcuts } from './useGlobalAppShortcuts';
import { getPathBaseName, isWorkspaceRelativeFilePath } from './workspace/workspaceFiles';

const QUICK_OPEN_RECENT_LIMIT = 20;
const EMPTY_QUICK_OPEN_FILES: QuickOpenFileEntry[] = [];
const WhiteboardView = lazy(() => import('./components/whiteboard/WhiteboardView').then((module) => ({ default: module.WhiteboardView })));
const WorkflowView = lazy(() => import('./components/workflow/WorkflowView').then((module) => ({ default: module.WorkflowView })));

// ─── ResizeHandle ────────────────────────────────────────────────────────────

const MainContentFallback = () => (
  <div className="flex flex-1 items-center justify-center bg-background text-muted-foreground text-sm">
    Loading view...
  </div>
);

const codeViewPlaceholderConfig = {
  simulation: {
    title: 'Simulation',
    testId: 'code-view-simulation',
  },
  synthesis: {
    title: 'Synthesis',
    testId: 'code-view-synthesis',
  },
  physical: {
    title: 'Physical Design',
    testId: 'code-view-physical',
  },
  factory: {
    title: 'Factory',
    testId: 'code-view-factory',
  },
} as const;

interface QuickOpenState {
  isVisible: boolean;
  query: string;
  selectedIndex: number;
  workspaceFiles: QuickOpenFileEntry[] | null;
  isLoading: boolean;
  errorMessage: string | null;
  recentFiles: QuickOpenFileEntry[];
  revealRequest: WorkspaceRevealRequest | null;
}

type QuickOpenAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'setQuery'; query: string }
  | { type: 'setSelectedIndex'; index: number }
  | { type: 'clampSelectedIndex'; resultCount: number }
  | { type: 'startIndexing' }
  | { type: 'finishIndexing'; files: QuickOpenFileEntry[] }
  | { type: 'failIndexing'; errorMessage: string }
  | { type: 'invalidateWorkspaceFiles' }
  | { type: 'recordRecentFile'; filePath: string; fileName: string }
  | { type: 'setRevealRequest'; revealRequest: WorkspaceRevealRequest };

const QUICK_OPEN_INITIAL_STATE: QuickOpenState = {
  isVisible: false,
  query: '',
  selectedIndex: 0,
  workspaceFiles: null,
  isLoading: false,
  errorMessage: null,
  recentFiles: [],
  revealRequest: null,
};

function quickOpenReducer(state: QuickOpenState, action: QuickOpenAction): QuickOpenState {
  switch (action.type) {
    case 'open':
      return {
        ...state,
        isVisible: true,
        query: '',
        selectedIndex: 0,
      };
    case 'close':
      return {
        ...state,
        isVisible: false,
        query: '',
        selectedIndex: 0,
      };
    case 'setQuery':
      if (state.query === action.query) {
        return state;
      }

      return {
        ...state,
        query: action.query,
      };
    case 'setSelectedIndex':
      if (state.selectedIndex === action.index) {
        return state;
      }

      return {
        ...state,
        selectedIndex: action.index,
      };
    case 'clampSelectedIndex': {
      const nextSelectedIndex = action.resultCount === 0
        ? 0
        : Math.min(state.selectedIndex, action.resultCount - 1);

      if (state.selectedIndex === nextSelectedIndex) {
        return state;
      }

      return {
        ...state,
        selectedIndex: nextSelectedIndex,
      };
    }
    case 'startIndexing':
      return {
        ...state,
        isLoading: true,
        errorMessage: null,
      };
    case 'finishIndexing':
      return {
        ...state,
        workspaceFiles: action.files,
        isLoading: false,
      };
    case 'failIndexing':
      return {
        ...state,
        isLoading: false,
        errorMessage: action.errorMessage,
      };
    case 'invalidateWorkspaceFiles':
      return {
        ...state,
        workspaceFiles: null,
        errorMessage: null,
      };
    case 'recordRecentFile': {
      const entry = { path: action.filePath, name: action.fileName };

      return {
        ...state,
        recentFiles: [entry, ...state.recentFiles.filter((item) => item.path !== action.filePath)].slice(0, QUICK_OPEN_RECENT_LIMIT),
      };
    }
    case 'setRevealRequest':
      return {
        ...state,
        revealRequest: action.revealRequest,
      };
    default:
      return state;
  }
}

// ─── AppLayout (consumes context) ────────────────────────────────────────────
function AppLayout() {
  const {
    activeView, setActiveView,
    canToggleLayoutPanels,
    closeActiveTabInFocusedGroup,
    mainContentView,
    activeTabId,
    createWorkspaceFile,
    createWorkspaceFolder,
    deleteWorkspaceEntry,
    openUntitledFile,
    openFile,
    openPreviewFile,
    renameWorkspaceEntry,
    jumpToLine, jumpTo,
    showLeftPanel, setShowLeftPanel,
    showBottomPanel, setShowBottomPanel,
    showRightPanel, setShowRightPanel,
    captureEditorSelectionSnapshot,
    cursorLine, cursorCol,
    dirtyFileIds,
    focusActiveEditor,
    openUnsavedChangesDialog,
    restoreEditorSelection,
    saveActiveFile,
    saveAllFiles,
    saveErrors,
    savingFiles,
    workspaceTreeRefreshToken,
  } = useWorkspace();
  const [quickOpenState, dispatchQuickOpen] = useReducer(quickOpenReducer, QUICK_OPEN_INITIAL_STATE);
  const [explorerLeftPanelWidthPx, setExplorerLeftPanelWidthPx] = useState(EXPLORER_LEFT_PANEL_DEFAULT_WIDTH_PX);
  const revealTokenRef = useRef(0);
  const lastHandledActiveFileRevealRef = useRef('');
  const quickOpenEditorSnapshotRef = useRef<EditorSelectionSnapshot | null>(null);

  const handleActivityItemSelect = (nextView: string) => {
    setActiveView(nextView as typeof activeView);
  };

  const restoreActiveEditorFocus = useCallback(() => {
    if (typeof window === 'undefined') {
      globalThis.setTimeout(() => {
        focusActiveEditor();
      }, 0);
      return;
    }

    const focusDeadline = window.performance.now() + 5000;

    const tryFocus = () => {
      focusActiveEditor();

      if (isMonacoTextInputFocused() || window.performance.now() >= focusDeadline) {
        return;
      }

      window.requestAnimationFrame(tryFocus);
    };

    window.requestAnimationFrame(tryFocus);
  }, [focusActiveEditor]);

  const closeQuickOpen = useCallback((options?: { restorePreviousEditor?: boolean }) => {
    const shouldRestorePreviousEditor = options?.restorePreviousEditor ?? true;
    const snapshot = quickOpenEditorSnapshotRef.current;

    quickOpenEditorSnapshotRef.current = null;
    dispatchQuickOpen({ type: 'close' });
    if (shouldRestorePreviousEditor && snapshot) {
      restoreEditorSelection(snapshot);
    }

    restoreActiveEditorFocus();
  }, [restoreActiveEditorFocus, restoreEditorSelection]);

  const openQuickOpen = useCallback(() => {
    quickOpenEditorSnapshotRef.current = captureEditorSelectionSnapshot();
    dispatchQuickOpen({ type: 'open' });
  }, [captureEditorSelectionSnapshot]);

  const invalidateWorkspaceFiles = useCallback(() => {
    dispatchQuickOpen({ type: 'invalidateWorkspaceFiles' });
  }, []);

  const recordRecentFile = useCallback((filePath: string, fileName: string) => {
    dispatchQuickOpen({ type: 'recordRecentFile', filePath, fileName });
  }, []);

  const queueRevealRequest = useCallback((filePath: string, options?: { markActiveFileHandled?: boolean }) => {
    if (!filePath || !isWorkspaceRelativeFilePath(filePath)) {
      return;
    }

    if (options?.markActiveFileHandled) {
      lastHandledActiveFileRevealRef.current = filePath;
    }

    revealTokenRef.current += 1;
    dispatchQuickOpen({
      type: 'setRevealRequest',
      revealRequest: { path: filePath, token: revealTokenRef.current },
    });
  }, []);

  const handleQuickOpenQueryChange = useCallback((query: string) => {
    dispatchQuickOpen({ type: 'setQuery', query });
  }, []);

  const handleQuickOpenSelectedIndexChange = useCallback((index: number) => {
    dispatchQuickOpen({ type: 'setSelectedIndex', index });
  }, []);

  const handleCreateUntitledFile = useCallback(() => {
    openUntitledFile();
    restoreActiveEditorFocus();
  }, [openUntitledFile, restoreActiveEditorFocus]);

  const openWorkspaceFile = useCallback((filePath: string, fileName: string) => {
    queueRevealRequest(filePath, { markActiveFileHandled: true });
    recordRecentFile(filePath, fileName);
    openFile(filePath, fileName);
  }, [openFile, queueRevealRequest, recordRecentFile]);

  const openWorkspacePreviewFile = useCallback((filePath: string, fileName: string) => {
    queueRevealRequest(filePath, { markActiveFileHandled: true });
    recordRecentFile(filePath, fileName);
    openPreviewFile(filePath, fileName);
  }, [openPreviewFile, queueRevealRequest, recordRecentFile]);

  const handleCreateWorkspaceFile = useCallback(async (targetPath: string) => {
    await createWorkspaceFile(targetPath);
    openWorkspaceFile(targetPath, getPathBaseName(targetPath));
    restoreActiveEditorFocus();
  }, [createWorkspaceFile, openWorkspaceFile, restoreActiveEditorFocus]);

  const handleCreateWorkspaceFolder = useCallback(async (targetPath: string) => {
    await createWorkspaceFolder(targetPath);
    queueRevealRequest(targetPath);
  }, [createWorkspaceFolder, queueRevealRequest]);

  const handleDeleteWorkspaceEntry = useCallback(async (
    targetPath: string,
    entryType: 'file' | 'folder',
  ) => {
    return deleteWorkspaceEntry(targetPath, entryType);
  }, [deleteWorkspaceEntry]);

  const handleRenameWorkspaceEntry = useCallback(async (
    currentPath: string,
    nextPath: string,
    entryType: 'file' | 'folder',
  ) => {
    await renameWorkspaceEntry(currentPath, nextPath, entryType);
    queueRevealRequest(nextPath, { markActiveFileHandled: entryType === 'file' });
  }, [queueRevealRequest, renameWorkspaceEntry]);

  const handleEditorActiveFileReveal = useCallback((filePath: string) => {
    queueRevealRequest(filePath, { markActiveFileHandled: true });
  }, [queueRevealRequest]);

  useEffect(() => {
    if (!activeTabId || activeTabId === lastHandledActiveFileRevealRef.current) {
      return;
    }

    lastHandledActiveFileRevealRef.current = activeTabId;
    if (isWorkspaceRelativeFilePath(activeTabId)) {
      queueRevealRequest(activeTabId);
    }
  }, [activeTabId, queueRevealRequest]);

  useEffect(() => {
    if (workspaceTreeRefreshToken === 0) {
      return;
    }

    invalidateWorkspaceFiles();
  }, [invalidateWorkspaceFiles, workspaceTreeRefreshToken]);

  useEffect(() => {
    const electronApi = typeof window === 'undefined' ? undefined : window.electronAPI;

    if (!electronApi?.onWindowFocus) {
      if (typeof window === 'undefined') {
        return undefined;
      }

      const handleWindowFocus = () => {
        refreshWorkspaceGitStatus();
      };

      window.addEventListener('focus', handleWindowFocus);

      return () => {
        window.removeEventListener('focus', handleWindowFocus);
      };
    }

    const disposeWindowFocus = electronApi.onWindowFocus(() => {
      refreshWorkspaceGitStatus();
    });

    return () => {
      disposeWindowFocus();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (!quickOpenState.isVisible || quickOpenState.workspaceFiles !== null) {
      return;
    }

    const fsApi = window.electronAPI?.fs;
    if (!fsApi) {
      dispatchQuickOpen({ type: 'failIndexing', errorMessage: 'Filesystem API unavailable' });
      return;
    }

    let cancelled = false;
    dispatchQuickOpen({ type: 'startIndexing' });

    void fsApi.listFiles('.')
      .then((paths) => {
        if (cancelled) {
          return;
        }

        dispatchQuickOpen({ type: 'finishIndexing', files: createQuickOpenFileEntries(paths) });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        dispatchQuickOpen({
          type: 'failIndexing',
          errorMessage: error instanceof Error ? error.message : 'Unable to index workspace files',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [quickOpenState.isVisible, quickOpenState.workspaceFiles]);

  const isQuickOpenRecentMode = quickOpenState.query.trim().length === 0;

  const quickOpenResults = useMemo(() => {
    if (isQuickOpenRecentMode) {
      return getRecentQuickOpenFiles(quickOpenState.recentFiles, quickOpenState.workspaceFiles);
    }

    return searchQuickOpenFiles(quickOpenState.workspaceFiles ?? EMPTY_QUICK_OPEN_FILES, quickOpenState.query);
  }, [isQuickOpenRecentMode, quickOpenState.query, quickOpenState.recentFiles, quickOpenState.workspaceFiles]);

  useEffect(() => {
    dispatchQuickOpen({ type: 'clampSelectedIndex', resultCount: quickOpenResults.length });
  }, [quickOpenResults.length]);

  const handleQuickOpenSelect = useCallback((result: QuickOpenSearchResult) => {
    openWorkspaceFile(result.path, result.name);
    closeQuickOpen({ restorePreviousEditor: false });
  }, [closeQuickOpen, openWorkspaceFile]);

  const renderPanelPlaceholder = (title: string, testId: string) => (
    <WorkflowView title={title} testId={testId} />
  );

  const activityBar = (
    <ActivityBar
      activeView={activeView}
      onItemSelect={handleActivityItemSelect}
    />
  );

  const renderWorkspaceShell = ({
    shellTestId,
    leftPanelId,
    centerPanelId,
    topPanelId,
    bottomPanelId,
    rightPanelId,
    leftContent,
    topContent,
    bottomContent,
    rightContent,
    overlay,
    leftFixedWidthPx,
    onLeftFixedWidthChange,
  }: {
    shellTestId?: string;
    leftPanelId: string;
    centerPanelId: string;
    topPanelId: string;
    bottomPanelId: string;
    rightPanelId: string;
    leftContent: React.ReactNode;
    topContent: React.ReactNode;
    bottomContent: React.ReactNode;
    rightContent: React.ReactNode;
    overlay?: React.ReactNode;
    leftFixedWidthPx?: number;
    onLeftFixedWidthChange?: React.Dispatch<React.SetStateAction<number>>;
  }) => (
    <CodeWorkspaceShell
      shellTestId={shellTestId}
      activityBar={activityBar}
      overlay={overlay}
      showLeftPanel={showLeftPanel}
      showBottomPanel={showBottomPanel}
      showRightPanel={showRightPanel}
      leftPanelId={leftPanelId}
      centerPanelId={centerPanelId}
      topPanelId={topPanelId}
      bottomPanelId={bottomPanelId}
      rightPanelId={rightPanelId}
      leftContent={leftContent}
      topContent={topContent}
      bottomContent={bottomContent}
      rightContent={rightContent}
      leftFixedWidthPx={leftFixedWidthPx}
      onLeftFixedWidthChange={onLeftFixedWidthChange}
    />
  );

  const renderExplorerWorkspace = () => (
    renderWorkspaceShell({
      leftPanelId: 'left-panel',
      centerPanelId: 'center-panel',
      topPanelId: 'editor-panel',
      bottomPanelId: 'bottom-panel',
      rightPanelId: 'right-panel',
      leftFixedWidthPx: explorerLeftPanelWidthPx,
      onLeftFixedWidthChange: setExplorerLeftPanelWidthPx,
      leftContent: (
        <LeftSidePanel
          activeFileId={activeTabId}
          onCreateWorkspaceFile={handleCreateWorkspaceFile}
          onCreateWorkspaceFolder={handleCreateWorkspaceFolder}
          onDeleteWorkspaceEntry={handleDeleteWorkspaceEntry}
          onFileOpen={openWorkspaceFile}
          onFilePreview={openWorkspacePreviewFile}
          onLineJump={jumpTo}
          onRenameWorkspaceEntry={handleRenameWorkspaceEntry}
          currentOutlineId={activeTabId}
          refreshToken={workspaceTreeRefreshToken}
          revealRequest={quickOpenState.revealRequest}
          onWorkspaceRefresh={invalidateWorkspaceFiles}
        />
      ),
      topContent: <EditorSplitLayout jumpToLine={jumpToLine} onActiveFileReveal={handleEditorActiveFileReveal} />,
      bottomContent: <BottomPanel onClose={() => setShowBottomPanel(false)} />,
      rightContent: (
        <RightSidePanel
          onFileOpen={openWorkspaceFile}
          onLineJump={jumpTo}
        />
      ),
      overlay: (
        <QuickOpenPalette
          isOpen={quickOpenState.isVisible}
          mode={isQuickOpenRecentMode ? 'recent' : 'search'}
          query={quickOpenState.query}
          results={quickOpenResults}
          selectedIndex={quickOpenState.selectedIndex}
          isLoading={quickOpenState.isLoading}
          errorMessage={quickOpenState.errorMessage}
          emptyMessage={isQuickOpenRecentMode ? 'No recently opened files' : 'No matching files'}
          onClose={closeQuickOpen}
          onQueryChange={handleQuickOpenQueryChange}
          onSelectedIndexChange={handleQuickOpenSelectedIndexChange}
          onSelectResult={handleQuickOpenSelect}
        />
      ),
    })
  );

  const renderSimulationWorkspace = () => (
    renderWorkspaceShell({
      shellTestId: 'code-view-simulation',
      leftPanelId: 'simulation-left-panel',
      centerPanelId: 'simulation-center-panel',
      topPanelId: 'simulation-main-panel',
      bottomPanelId: 'simulation-bottom-panel',
      rightPanelId: 'simulation-right-panel',
      leftContent: renderPanelPlaceholder('Left Panel', 'simulation-left-panel-content'),
      topContent: renderPanelPlaceholder('Simulation Workspace', 'simulation-main-panel-content'),
      bottomContent: renderPanelPlaceholder('Bottom Panel', 'simulation-bottom-panel-content'),
      rightContent: renderPanelPlaceholder('Right Panel', 'simulation-right-panel-content'),
    })
  );

  const renderCodePlaceholder = () => {
    const placeholder = codeViewPlaceholderConfig[activeView as keyof typeof codeViewPlaceholderConfig];

    if (!placeholder) {
      return renderExplorerWorkspace();
    }

    return (
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar
          activeView={activeView}
          onItemSelect={handleActivityItemSelect}
        />
        <div className="flex-1 min-h-0">
          <Suspense fallback={<MainContentFallback />}>
            <WorkflowView title={placeholder.title} testId={placeholder.testId} />
          </Suspense>
        </div>
      </div>
    );
  };

  const { failedSaveFileCount, savingFileCount } = useMemo(() => {
    let nextSavingFileCount = 0;
    let nextFailedSaveFileCount = 0;

    for (const fileId of dirtyFileIds) {
      if (savingFiles[fileId]) {
        nextSavingFileCount += 1;
      }

      if (saveErrors[fileId]) {
        nextFailedSaveFileCount += 1;
      }
    }

    return {
      failedSaveFileCount: nextFailedSaveFileCount,
      savingFileCount: nextSavingFileCount,
    };
  }, [dirtyFileIds, saveErrors, savingFiles]);

  useGlobalAppShortcuts({
    canToggleLayoutPanels,
    closeActiveTabInFocusedGroup,
    closeQuickOpen,
    isQuickOpenVisible: quickOpenState.isVisible,
    openUntitledFile: handleCreateUntitledFile,
    openQuickOpen,
    saveActiveFile,
    setShowBottomPanel,
    setShowLeftPanel,
    showBottomPanel,
    showLeftPanel,
  });

  return (
    <SidebarProvider
      defaultOpen={false}
      keyboardShortcut={false}
      style={{ '--sidebar-width': '13rem' } as React.CSSProperties}
      className="flex h-screen min-h-0 flex-col bg-background text-foreground overflow-hidden"
    >
      <MenuBar
        showLeftPanel={showLeftPanel}
        showBottomPanel={showBottomPanel}
        showRightPanel={showRightPanel}
        onShowLeftPanelChange={setShowLeftPanel}
        onShowBottomPanelChange={setShowBottomPanel}
        onShowRightPanelChange={setShowRightPanel}
      />
      <UnsavedChangesDialog />
      <DeleteConfirmationDialog />

      {mainContentView === 'code'
        ? (activeView === 'explorer'
          ? renderExplorerWorkspace()
          : activeView === 'simulation'
            ? renderSimulationWorkspace()
            : renderCodePlaceholder())
        : mainContentView === 'whiteboard' ? (
          <div className="flex-1 min-h-0">
            <Suspense fallback={<MainContentFallback />}>
              <WhiteboardView />
            </Suspense>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <Suspense fallback={<MainContentFallback />}>
              <WorkflowView />
            </Suspense>
          </div>
        )}

      <AppStatusBar
        mainContentView={mainContentView}
        activeView={activeView}
        activeFileId={activeTabId}
        cursorLine={cursorLine}
        cursorCol={cursorCol}
        dirtyFileCount={dirtyFileIds.length}
        failedSaveFileCount={failedSaveFileCount}
        savingFileCount={savingFileCount}
        onOpenUnsavedFiles={openUnsavedChangesDialog}
        onSaveAll={() => {
          void saveAllFiles();
        }}
      />
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <AppLayout />
    </WorkspaceProvider>
  );
}