import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
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
import { isMonacoTextInputFocused } from './editor/focusEditor';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { SidebarProvider } from './components/ui/sidebar';
import { refreshWorkspaceGitStatus } from './git/workspaceGitStatus';
import { useGlobalAppShortcuts } from './useGlobalAppShortcuts';
import { getPathBaseName } from './workspace/workspaceFiles';
import { useQuickOpenController } from './useQuickOpenController';

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

// ─── AppLayout (consumes context) ────────────────────────────────────────────
function AppLayout() {
  const {
    activeView, setActiveView,
    canToggleLayoutPanels,
    closeActiveTabInFocusedGroup,
    mainContentView,
    activeTabId,
    clearWorkspaceClipboard,
    copyWorkspaceEntry,
    createWorkspaceFile,
    createWorkspaceFolder,
    cutWorkspaceEntry,
    deleteWorkspaceEntry,
    openUntitledFile,
    openFile,
    openPreviewFile,
    pasteWorkspaceEntry,
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
    workspaceClipboard,
    workspaceTreeRefreshToken,
  } = useWorkspace();
  const [explorerLeftPanelWidthPx, setExplorerLeftPanelWidthPx] = useState(EXPLORER_LEFT_PANEL_DEFAULT_WIDTH_PX);

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

  const {
    closeQuickOpen,
    handleEditorActiveFileReveal,
    handleQuickOpenQueryChange,
    handleQuickOpenSelect,
    handleQuickOpenSelectedIndexChange,
    invalidateWorkspaceFiles,
    isQuickOpenRecentMode,
    openQuickOpen,
    openWorkspaceFile,
    openWorkspacePreviewFile,
    queueRevealRequest,
    quickOpenResults,
    quickOpenState,
  } = useQuickOpenController({
    activeTabId,
    captureEditorSelectionSnapshot,
    openFile,
    openPreviewFile,
    restoreActiveEditorFocus,
    restoreEditorSelection,
    workspaceTreeRefreshToken,
  });

  const handleCreateUntitledFile = useCallback(() => {
    openUntitledFile();
    restoreActiveEditorFocus();
  }, [openUntitledFile, restoreActiveEditorFocus]);

  const handleCreateWorkspaceFile = useCallback(async (targetPath: string) => {
    await createWorkspaceFile(targetPath);
    openWorkspaceFile(targetPath, getPathBaseName(targetPath));
    restoreActiveEditorFocus();
  }, [createWorkspaceFile, openWorkspaceFile, restoreActiveEditorFocus]);

  const handleCreateWorkspaceFolder = useCallback(async (targetPath: string) => {
    await createWorkspaceFolder(targetPath);
    queueRevealRequest(targetPath);
  }, [createWorkspaceFolder, queueRevealRequest]);

  const handleCopyWorkspaceEntry = useCallback((targetPath: string, entryType: 'file' | 'folder') => {
    return copyWorkspaceEntry(targetPath, entryType);
  }, [copyWorkspaceEntry]);

  const handleCutWorkspaceEntry = useCallback((targetPath: string, entryType: 'file' | 'folder') => {
    return cutWorkspaceEntry(targetPath, entryType);
  }, [cutWorkspaceEntry]);

  const handlePasteWorkspaceEntry = useCallback(async (destinationFolderPath: string) => {
    const pastedEntry = await pasteWorkspaceEntry(destinationFolderPath);

    if (pastedEntry) {
      queueRevealRequest(pastedEntry.path);
    }

    return pastedEntry;
  }, [pasteWorkspaceEntry, queueRevealRequest]);

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
          onClearWorkspaceClipboard={clearWorkspaceClipboard}
          onCopyWorkspaceEntry={handleCopyWorkspaceEntry}
          onCreateWorkspaceFile={handleCreateWorkspaceFile}
          onCreateWorkspaceFolder={handleCreateWorkspaceFolder}
          onCutWorkspaceEntry={handleCutWorkspaceEntry}
          onDeleteWorkspaceEntry={handleDeleteWorkspaceEntry}
          onFileOpen={openWorkspaceFile}
          onFilePreview={openWorkspacePreviewFile}
          onLineJump={jumpTo}
          onPasteWorkspaceEntry={handlePasteWorkspaceEntry}
          onRenameWorkspaceEntry={handleRenameWorkspaceEntry}
          currentOutlineId={activeTabId}
          refreshToken={workspaceTreeRefreshToken}
          revealRequest={quickOpenState.revealRequest}
          onWorkspaceRefresh={invalidateWorkspaceFiles}
          workspaceClipboard={workspaceClipboard}
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
    setShowRightPanel,
    showBottomPanel,
    showLeftPanel,
    showRightPanel,
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
