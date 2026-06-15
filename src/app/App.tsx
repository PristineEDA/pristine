import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { MenuBar } from './components/code/shared/MenuBar';
import { DeleteConfirmationDialog } from './components/code/shared/DeleteConfirmationDialog';
import { UnsavedChangesDialog } from './components/code/shared/UnsavedChangesDialog';
import { ActivityBar } from './components/code/shared/ActivityBar';
import { LeftSidePanel } from './components/code/explorer/LeftSidePanel';
import { EditorSplitLayout } from './components/code/shared/EditorSplitLayout';
import { RightSidePanel } from './components/code/explorer/RightSidePanel';
import { BottomPanel } from './components/code/explorer/BottomPanel';
import {
  ASSISTANT_THREAD_LIST_DEFAULT_WIDTH_PX,
  ASSISTANT_THREAD_LIST_RESIZE_HANDLE_WIDTH_PX,
} from './components/code/explorer/assistantPanelLayout';
import {
  CodeWorkspaceShell,
  type CodeWorkspaceBottomPanelControls,
  EXPLORER_LEFT_PANEL_DEFAULT_WIDTH_PX,
  EXPLORER_RIGHT_PANEL_MAX_WIDTH_PX,
  EXPLORER_RIGHT_PANEL_MIN_WIDTH_PX,
  EXPLORER_RIGHT_PANEL_DEFAULT_WIDTH_PX,
} from './components/code/shared/CodeWorkspaceShell';
import { AppStatusBar } from './components/code/shared/statusBars/AppStatusBar';
import {
  PhysicalBottomPanel,
  PhysicalLeftPanel,
  PhysicalMainPanel,
  PhysicalRightPanel,
  type PhysicalLayoutFileEntry,
  type PhysicalWorkspaceLayoutState,
} from './components/code/physical/PhysicalWorkspacePanels';
import {
  createEmptyPhysicalLayoutVisibility,
  createPhysicalLayoutVisibility,
  createLayerCategoryVisibilityKey,
  createOutlineVisibilityKey,
  filterVisiblePhysicalLayoutShapes,
  type PhysicalLayoutLayerCategory,
  type MutablePhysicalLayoutVisibility,
} from './components/code/physical/physicalLayoutLayers';
import {
  getDefaultLayoutTarget,
  selectLayoutTargetShapes,
  type PhysicalLayoutTarget,
} from './components/code/physical/physicalLayoutGeometry';
import { QuickOpenPalette } from './components/code/shared/QuickOpenPalette';
import { isMonacoTextInputFocused } from './editor/focusEditor';
import {
  WorkspaceProvider,
  useWorkspaceDialogs,
  useWorkspaceEditor,
  useWorkspaceFiles,
  useWorkspaceView,
} from './context/WorkspaceContext';
import { CodeViewerLayoutProvider } from './context/CodeViewerLayoutContext';
import { ModuleHierarchyProvider } from './context/ModuleHierarchyContext';
import { SidebarProvider } from './components/ui/sidebar';
import { refreshWorkspaceGitStatus } from './git/workspaceGitStatus';
import { useGlobalAppShortcuts } from './useGlobalAppShortcuts';
import { getPathBaseName } from './workspace/workspaceFiles';
import { useQuickOpenController } from './useQuickOpenController';
import { preloadDeferredMainContentViews } from './mainContentViewPreload';

const WorkflowView = lazy(() => import('./components/workflow/WorkflowView').then((module) => ({ default: module.WorkflowView })));
const WhiteboardView = lazy(() => import('./components/whiteboard/WhiteboardView').then((module) => ({ default: module.WhiteboardView })));

// ─── ResizeHandle ────────────────────────────────────────────────────────────

const MainContentFallback = () => (
  <div className="flex flex-1 items-center justify-center bg-background text-muted-foreground text-sm">
    Loading view...
  </div>
);

const PlaceholderView = ({
  title,
  description = 'Coming soon',
  testId,
}: {
  title: string;
  description?: string;
  testId: string;
}) => (
  <div data-testid={testId} className="flex h-full w-full items-center justify-center bg-background text-muted-foreground">
    <div className="text-center">
      <p className="text-lg font-medium">{title}</p>
      <p className="mt-1 text-sm">{description}</p>
    </div>
  </div>
);

const codeViewPlaceholderConfig = {
  factory: {
    title: 'Factory',
    testId: 'code-view-factory',
  },
} as const;

type PlaceholderWorkspaceView = 'simulation' | 'synthesis';

// ─── AppLayout (consumes context) ────────────────────────────────────────────
function AppLayout() {
  const {
    activeView, setActiveView,
    canToggleLayoutPanels,
    mainContentView,
    showLeftPanel, setShowLeftPanel,
    showBottomPanel, setShowBottomPanel,
    showRightPanel, setShowRightPanel,
    workspaceTreeRefreshToken,
  } = useWorkspaceView();
  const {
    activeTabId,
    captureEditorSelectionSnapshot,
    closeActiveTabInFocusedGroup,
    cursorLine, cursorCol,
    focusActiveEditor,
    jumpToLine, jumpTo,
    openFile,
    openGitDiff,
    openPreviewFile,
    openUntitledFile,
    restoreEditorSelection,
  } = useWorkspaceEditor();
  const {
    clearWorkspaceClipboard,
    copyWorkspaceEntry,
    createWorkspaceFile,
    createWorkspaceFolder,
    cutWorkspaceEntry,
    deleteWorkspaceEntry,
    pasteWorkspaceEntry,
    renameWorkspaceEntry,
    dirtyFileIds,
    saveActiveFile,
    saveAllFiles,
    saveErrors,
    savingFiles,
    workspaceClipboard,
  } = useWorkspaceFiles();
  const { openUnsavedChangesDialog } = useWorkspaceDialogs();
  const [explorerLeftPanelWidthPx, setExplorerLeftPanelWidthPx] = useState(EXPLORER_LEFT_PANEL_DEFAULT_WIDTH_PX);
  const [explorerAssistantPanelWidthPx, setExplorerAssistantPanelWidthPx] = useState(EXPLORER_RIGHT_PANEL_DEFAULT_WIDTH_PX);
  const [isExplorerLeftPanelSplitVisible, setIsExplorerLeftPanelSplitVisible] = useState(false);
  const [isExplorerRightPanelSplitVisible, setIsExplorerRightPanelSplitVisible] = useState(false);
  const [physicalLeftPanelWidthPx, setPhysicalLeftPanelWidthPx] = useState(EXPLORER_LEFT_PANEL_DEFAULT_WIDTH_PX);
  const [physicalRightPanelWidthPx, setPhysicalRightPanelWidthPx] = useState(EXPLORER_RIGHT_PANEL_DEFAULT_WIDTH_PX);
  const [isPhysicalLeftPanelSplitVisible, setIsPhysicalLeftPanelSplitVisible] = useState(false);
  const [isPhysicalRightPanelSplitVisible, setIsPhysicalRightPanelSplitVisible] = useState(false);
  const [physicalLayoutState, setPhysicalLayoutState] = useState<PhysicalWorkspaceLayoutState>({
    catalog: null,
    error: null,
    geometry: null,
    openResult: null,
    status: 'idle',
  });
  const [physicalLayoutFiles, setPhysicalLayoutFiles] = useState<PhysicalLayoutFileEntry[]>([]);
  const [expandedPhysicalLayoutFilePaths, setExpandedPhysicalLayoutFilePaths] = useState<Set<string>>(() => new Set());
  const [activePhysicalLayoutFilePath, setActivePhysicalLayoutFilePath] = useState<string | null>(null);
  const [physicalSelectedTarget, setPhysicalSelectedTarget] = useState<PhysicalLayoutTarget | null>(null);
  const [physicalHighlightedShapeIndex, setPhysicalHighlightedShapeIndex] = useState<number | null>(null);
  const [physicalLayoutVisibility, setPhysicalLayoutVisibility] = useState<MutablePhysicalLayoutVisibility>(() => (
    createEmptyPhysicalLayoutVisibility()
  ));
  const [assistantThreadListExpanded, setAssistantThreadListExpanded] = useState(false);
  const [assistantThreadListWidthPx, setAssistantThreadListWidthPx] = useState(ASSISTANT_THREAD_LIST_DEFAULT_WIDTH_PX);
  const [shouldMountWorkflowView, setShouldMountWorkflowView] = useState(mainContentView === 'workflow');
  const [shouldMountWhiteboardView, setShouldMountWhiteboardView] = useState(mainContentView === 'whiteboard');
  const explorerBottomPanelLayoutVersion = `${showLeftPanel}:${showRightPanel}:${showBottomPanel}:${explorerLeftPanelWidthPx}`;
  const assistantThreadListExtraWidthPx = assistantThreadListExpanded
    ? assistantThreadListWidthPx + ASSISTANT_THREAD_LIST_RESIZE_HANDLE_WIDTH_PX
    : 0;
  const explorerRightPanelWidthPx = explorerAssistantPanelWidthPx + assistantThreadListExtraWidthPx;
  const explorerRightPanelMinWidthPx = EXPLORER_RIGHT_PANEL_MIN_WIDTH_PX + assistantThreadListExtraWidthPx;
  const explorerRightPanelMaxWidthPx = EXPLORER_RIGHT_PANEL_MAX_WIDTH_PX + assistantThreadListExtraWidthPx;

  useEffect(() => {
    let disposed = false;

    async function loadPhysicalLayoutFiles() {
      const entries = await window.electronAPI?.fs.readDir?.('.');
      if (disposed || !Array.isArray(entries)) {
        return;
      }

      const files = entries
        .filter((entry) => entry.isFile)
        .map((entry) => {
          const extension = getPhysicalLayoutFileExtension(entry.name);
          return { extension, name: entry.name, path: entry.name };
        })
        .filter((entry): entry is PhysicalLayoutFileEntry => isPhysicalLayoutFileExtension(entry.extension))
        .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }));
      setPhysicalLayoutFiles(files);
    }

    void loadPhysicalLayoutFiles().catch(() => {
      if (!disposed) {
        setPhysicalLayoutFiles([]);
      }
    });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const defaultTarget = getDefaultLayoutTarget(physicalLayoutState.catalog);
    if (!physicalSelectedTarget && defaultTarget) {
      setPhysicalSelectedTarget(defaultTarget);
    }
  }, [physicalLayoutState.catalog, physicalSelectedTarget]);

  useEffect(() => {
    const shapes = selectLayoutTargetShapes(physicalLayoutState.catalog, physicalLayoutState.geometry, physicalSelectedTarget);
    setPhysicalLayoutVisibility(createPhysicalLayoutVisibility(physicalLayoutState.catalog, Boolean(physicalSelectedTarget), shapes));
  }, [physicalLayoutState.catalog, physicalLayoutState.geometry, physicalSelectedTarget]);

  useEffect(() => {
    setPhysicalHighlightedShapeIndex(null);
  }, [activePhysicalLayoutFilePath, physicalLayoutState.geometry, physicalSelectedTarget]);

  useEffect(() => {
    if (physicalHighlightedShapeIndex === null) {
      return;
    }

    const selectedShapes = selectLayoutTargetShapes(physicalLayoutState.catalog, physicalLayoutState.geometry, physicalSelectedTarget);
    const visibleShapes = filterVisiblePhysicalLayoutShapes(selectedShapes, physicalLayoutVisibility);
    if (!visibleShapes.some((shape) => shape.index === physicalHighlightedShapeIndex)) {
      setPhysicalHighlightedShapeIndex(null);
    }
  }, [
    physicalHighlightedShapeIndex,
    physicalLayoutState.catalog,
    physicalLayoutState.geometry,
    physicalLayoutVisibility,
    physicalSelectedTarget,
  ]);

  const handlePhysicalOutlineVisibilityToggle = useCallback(() => {
    setPhysicalLayoutVisibility((current) => {
      const nextItems = new Set(current.visibleItems);
      const outlineKey = createOutlineVisibilityKey();
      if (nextItems.has(outlineKey)) {
        nextItems.delete(outlineKey);
      } else {
        nextItems.add(outlineKey);
      }

      return {
        outlineVisible: nextItems.has(outlineKey),
        visibleItems: nextItems,
      };
    });
  }, []);

  const handlePhysicalLayerCategoryVisibilityToggle = useCallback((
    layerIndex: number,
    category: PhysicalLayoutLayerCategory,
  ) => {
    setPhysicalLayoutVisibility((current) => {
      const nextItems = new Set(current.visibleItems);
      const key = createLayerCategoryVisibilityKey(layerIndex, category);
      if (nextItems.has(key)) {
        nextItems.delete(key);
      } else {
        nextItems.add(key);
      }

      return {
        outlineVisible: current.outlineVisible,
        visibleItems: nextItems,
      };
    });
  }, []);

  const handlePhysicalLayoutFileToggle = useCallback((file: PhysicalLayoutFileEntry) => {
    setExpandedPhysicalLayoutFilePaths((current) => {
      const next = new Set(current);
      if (next.has(file.path)) {
        next.delete(file.path);
      } else {
        next.add(file.path);
      }
      return next;
    });

    setPhysicalHighlightedShapeIndex(null);
    setPhysicalSelectedTarget(null);
    setActivePhysicalLayoutFilePath(file.path);
    setPhysicalLayoutState({
      catalog: null,
      error: null,
      geometry: null,
      openResult: null,
      status: 'loading',
    });
  }, []);

  const handlePhysicalLayoutTargetActivate = useCallback((target: PhysicalLayoutTarget) => {
    setPhysicalHighlightedShapeIndex(null);
    setPhysicalSelectedTarget(target);
  }, []);

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

  useEffect(() => {
    if (mainContentView === 'workflow') {
      setShouldMountWorkflowView(true);
      return;
    }

    if (mainContentView === 'whiteboard') {
      setShouldMountWhiteboardView(true);
    }
  }, [mainContentView]);

  useEffect(() => {
    return preloadDeferredMainContentViews({
      requestWorkflowMount: () => {
        setShouldMountWorkflowView(true);
      },
      requestWhiteboardMount: () => {
        setShouldMountWhiteboardView(true);
      },
    });
  }, []);

  const renderPanelPlaceholder = (title: string, testId: string) => (
    <PlaceholderView title={title} testId={testId} />
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
    enableBottomPanelMaximize,
    onBottomPanelAutoHide,
    overlay,
    useLeftPanelFrame,
    useRightPanelFrame,
    leftFixedWidthPx,
    onLeftFixedWidthChange,
    rightFixedWidthPx,
    onRightFixedWidthChange,
    rightFixedMinWidthPx,
    rightFixedMaxWidthPx,
  }: {
    shellTestId?: string;
    leftPanelId: string;
    centerPanelId: string;
    topPanelId: string;
    bottomPanelId: string;
    rightPanelId: string;
    leftContent: React.ReactNode;
    topContent: React.ReactNode;
    bottomContent: React.ReactNode | ((controls: CodeWorkspaceBottomPanelControls) => React.ReactNode);
    rightContent: React.ReactNode;
    enableBottomPanelMaximize?: boolean;
    onBottomPanelAutoHide?: () => void;
    overlay?: React.ReactNode;
    useLeftPanelFrame?: boolean;
    useRightPanelFrame?: boolean;
    leftFixedWidthPx?: number;
    onLeftFixedWidthChange?: React.Dispatch<React.SetStateAction<number>>;
    rightFixedWidthPx?: number;
    onRightFixedWidthChange?: React.Dispatch<React.SetStateAction<number>>;
    rightFixedMinWidthPx?: number;
    rightFixedMaxWidthPx?: number;
  }) => (
    <CodeWorkspaceShell
      shellTestId={shellTestId}
      activityBar={activityBar}
      overlay={overlay}
      useLeftPanelFrame={useLeftPanelFrame}
      useRightPanelFrame={useRightPanelFrame}
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
      enableBottomPanelMaximize={enableBottomPanelMaximize}
      onBottomPanelAutoHide={onBottomPanelAutoHide}
      leftFixedWidthPx={leftFixedWidthPx}
      onLeftFixedWidthChange={onLeftFixedWidthChange}
      rightFixedWidthPx={rightFixedWidthPx}
      onRightFixedWidthChange={onRightFixedWidthChange}
      rightFixedMinWidthPx={rightFixedMinWidthPx}
      rightFixedMaxWidthPx={rightFixedMaxWidthPx}
    />
  );

  const renderExplorerWorkspace = () => (
    renderWorkspaceShell({
      shellTestId: 'code-view-explorer',
      leftPanelId: 'left-panel',
      centerPanelId: 'center-panel',
      topPanelId: 'editor-panel',
      bottomPanelId: 'bottom-panel',
      rightPanelId: 'right-panel',
      useLeftPanelFrame: !isExplorerLeftPanelSplitVisible,
      useRightPanelFrame: !isExplorerRightPanelSplitVisible,
      leftFixedWidthPx: explorerLeftPanelWidthPx,
      onLeftFixedWidthChange: setExplorerLeftPanelWidthPx,
      rightFixedWidthPx: explorerRightPanelWidthPx,
      onRightFixedWidthChange: (nextValue) => {
        setExplorerAssistantPanelWidthPx((currentWidth) => {
          const currentTotalWidth = currentWidth + assistantThreadListExtraWidthPx;
          const nextTotalWidth = typeof nextValue === 'function'
            ? nextValue(currentTotalWidth)
            : nextValue;

          return nextTotalWidth - assistantThreadListExtraWidthPx;
        });
      },
      rightFixedMinWidthPx: explorerRightPanelMinWidthPx,
      rightFixedMaxWidthPx: explorerRightPanelMaxWidthPx,
      leftContent: (
        <LeftSidePanel
          activeFileId={activeTabId}
          onClearWorkspaceClipboard={clearWorkspaceClipboard}
          onCopyWorkspaceEntry={handleCopyWorkspaceEntry}
          onSplitPanelVisibleChange={setIsExplorerLeftPanelSplitVisible}
          onCreateWorkspaceFile={handleCreateWorkspaceFile}
          onCreateWorkspaceFolder={handleCreateWorkspaceFolder}
          onCutWorkspaceEntry={handleCutWorkspaceEntry}
          onDeleteWorkspaceEntry={handleDeleteWorkspaceEntry}
          onGitDiffOpen={openGitDiff}
          onFileOpen={openWorkspaceFile}
          onFilePreview={openWorkspacePreviewFile}
          onLineJump={jumpTo}
          onPasteWorkspaceEntry={handlePasteWorkspaceEntry}
          onRenameWorkspaceEntry={handleRenameWorkspaceEntry}
          refreshToken={workspaceTreeRefreshToken}
          revealRequest={quickOpenState.revealRequest}
          workspaceClipboard={workspaceClipboard}
        />
      ),
      topContent: <EditorSplitLayout jumpToLine={jumpToLine} onActiveFileReveal={handleEditorActiveFileReveal} />,
      bottomContent: ({ isMaximized, onMaximizeToggle }) => (
        <BottomPanel
          isMaximized={isMaximized}
          layoutVersion={explorerBottomPanelLayoutVersion}
          onClose={() => setShowBottomPanel(false)}
          onMaximizeToggle={onMaximizeToggle}
        />
      ),
      enableBottomPanelMaximize: true,
      onBottomPanelAutoHide: () => setShowBottomPanel(false),
      rightContent: (
        <RightSidePanel
          currentOutlineId={activeTabId}
          onFileOpen={openWorkspaceFile}
          onLineJump={jumpTo}
          onSplitPanelVisibleChange={setIsExplorerRightPanelSplitVisible}
          onThreadListExpandedChange={setAssistantThreadListExpanded}
          onThreadListWidthChange={setAssistantThreadListWidthPx}
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

  const renderPlaceholderWorkspace = (viewId: PlaceholderWorkspaceView, mainTitle: string) => (
    renderWorkspaceShell({
      shellTestId: `code-view-${viewId}`,
      leftPanelId: `${viewId}-left-panel`,
      centerPanelId: `${viewId}-center-panel`,
      topPanelId: `${viewId}-main-panel`,
      bottomPanelId: `${viewId}-bottom-panel`,
      rightPanelId: `${viewId}-right-panel`,
      leftContent: renderPanelPlaceholder('Left Panel', `${viewId}-left-panel-content`),
      topContent: renderPanelPlaceholder(mainTitle, `${viewId}-main-panel-content`),
      bottomContent: renderPanelPlaceholder('Bottom Panel', `${viewId}-bottom-panel-content`),
      rightContent: renderPanelPlaceholder('Right Panel', `${viewId}-right-panel-content`),
    })
  );

  const renderPhysicalWorkspace = () => (
    renderWorkspaceShell({
      shellTestId: 'code-view-physical',
      leftPanelId: 'physical-left-panel',
      centerPanelId: 'physical-center-panel',
      topPanelId: 'physical-main-panel',
      bottomPanelId: 'physical-bottom-panel',
      rightPanelId: 'physical-right-panel',
      useLeftPanelFrame: !isPhysicalLeftPanelSplitVisible,
      useRightPanelFrame: !isPhysicalRightPanelSplitVisible,
      leftFixedWidthPx: physicalLeftPanelWidthPx,
      onLeftFixedWidthChange: setPhysicalLeftPanelWidthPx,
      rightFixedWidthPx: physicalRightPanelWidthPx,
      onRightFixedWidthChange: setPhysicalRightPanelWidthPx,
      rightFixedMinWidthPx: EXPLORER_RIGHT_PANEL_MIN_WIDTH_PX,
      rightFixedMaxWidthPx: EXPLORER_RIGHT_PANEL_MAX_WIDTH_PX,
      leftContent: (
        <PhysicalLeftPanel
          activeLayoutFilePath={activePhysicalLayoutFilePath}
          catalog={physicalLayoutState.catalog}
          expandedLayoutFilePaths={expandedPhysicalLayoutFilePaths}
          layoutFiles={physicalLayoutFiles}
          selectedTarget={physicalSelectedTarget}
          onLayoutFileToggle={handlePhysicalLayoutFileToggle}
          onLayoutTargetActivate={handlePhysicalLayoutTargetActivate}
          onSplitPanelVisibleChange={setIsPhysicalLeftPanelSplitVisible}
        />
      ),
      topContent: (
        <PhysicalMainPanel
          activeLayoutFilePath={activePhysicalLayoutFilePath}
          highlightedShapeIndex={physicalHighlightedShapeIndex}
          layoutVisibility={physicalLayoutVisibility}
          selectedTarget={physicalSelectedTarget}
          onHighlightedShapeChange={setPhysicalHighlightedShapeIndex}
          onSelectedTargetChange={setPhysicalSelectedTarget}
          onLayoutStateChange={setPhysicalLayoutState}
        />
      ),
      bottomContent: ({ isMaximized, onMaximizeToggle }) => (
        <PhysicalBottomPanel
          isMaximized={isMaximized}
          layoutState={physicalLayoutState}
          onClose={() => setShowBottomPanel(false)}
          onMaximizeToggle={onMaximizeToggle}
        />
      ),
      enableBottomPanelMaximize: true,
      onBottomPanelAutoHide: () => setShowBottomPanel(false),
      rightContent: (
        <PhysicalRightPanel
          highlightedShapeIndex={physicalHighlightedShapeIndex}
          layoutVisibility={physicalLayoutVisibility}
          layoutState={physicalLayoutState}
          selectedTarget={physicalSelectedTarget}
          onLayerCategoryVisibilityToggle={handlePhysicalLayerCategoryVisibilityToggle}
          onOutlineVisibilityToggle={handlePhysicalOutlineVisibilityToggle}
          onSplitPanelVisibleChange={setIsPhysicalRightPanelSplitVisible}
        />
      ),
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
            <PlaceholderView title={placeholder.title} testId={placeholder.testId} />
          </Suspense>
        </div>
      </div>
    );
  };

  const renderDeferredMainContentLayer = ({
    active,
    children,
    mounted,
    testId,
  }: {
    active: boolean;
    children: React.ReactNode;
    mounted: boolean;
    testId: string;
  }) => {
    if (!mounted) {
      return null;
    }

    return (
      <div
        data-testid={testId}
        data-active={active ? 'true' : 'false'}
        data-mounted="true"
        aria-hidden={!active}
        className={`absolute inset-0 min-h-0 ${active ? 'z-10' : '-z-10 opacity-0 pointer-events-none'}`}
      >
        {children}
      </div>
    );
  };

  const renderMainContentStack = () => {
    const isCodeViewActive = mainContentView === 'code';
    const isWhiteboardViewActive = mainContentView === 'whiteboard';
    const isWorkflowViewActive = mainContentView === 'workflow';

    return (
      <div data-testid="main-content-stack" className="relative flex flex-1 min-h-0 flex-col overflow-hidden">
        {isCodeViewActive
          ? (activeView === 'explorer'
            ? renderExplorerWorkspace()
            : activeView === 'simulation'
              ? renderPlaceholderWorkspace('simulation', 'Simulation Workspace')
              : activeView === 'synthesis'
                ? renderPlaceholderWorkspace('synthesis', 'Synthesis')
                : activeView === 'physical'
                  ? renderPhysicalWorkspace()
                  : renderCodePlaceholder())
          : null}

        {renderDeferredMainContentLayer({
          active: isWhiteboardViewActive,
          mounted: shouldMountWhiteboardView || isWhiteboardViewActive,
          testId: 'main-content-whiteboard-layer',
          children: (
            <Suspense fallback={<MainContentFallback />}>
              <WhiteboardView isActive={isWhiteboardViewActive} />
            </Suspense>
          ),
        })}

        {renderDeferredMainContentLayer({
          active: isWorkflowViewActive,
          mounted: shouldMountWorkflowView || isWorkflowViewActive,
          testId: 'main-content-workflow-layer',
          children: (
            <Suspense fallback={<MainContentFallback />}>
              <WorkflowView isActive={isWorkflowViewActive} />
            </Suspense>
          ),
        })}
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

      {renderMainContentStack()}

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

function getPhysicalLayoutFileExtension(fileName: string): string {
  const normalized = fileName.toLowerCase();
  const index = normalized.lastIndexOf('.');
  return index >= 0 ? normalized.slice(index) : '';
}

function isPhysicalLayoutFileExtension(extension: string): boolean {
  return extension === '.lef'
    || extension === '.def'
    || extension === '.gds'
    || extension === '.gdsii'
    || extension === '.oas'
    || extension === '.oasis';
}

export default function App() {
  return (
    <WorkspaceProvider>
      <CodeViewerLayoutProvider>
        <ModuleHierarchyProvider>
          <AppLayout />
        </ModuleHierarchyProvider>
      </CodeViewerLayoutProvider>
    </WorkspaceProvider>
  );
}
