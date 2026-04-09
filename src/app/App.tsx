import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type PanelImperativeHandle } from './components/ui/resizable';
import { MenuBar } from './components/code/shared/MenuBar';
import { ActivityBar } from './components/code/shared/ActivityBar';
import { LeftSidePanel } from './components/code/explorer/LeftSidePanel';
import { EditorSplitLayout } from './components/code/shared/EditorSplitLayout';
import { RightSidePanel } from './components/code/explorer/RightSidePanel';
import { BottomPanel } from './components/code/explorer/BottomPanel';
import { CodeWorkspaceShell } from './components/code/shared/CodeWorkspaceShell';
import { AppStatusBar } from './components/code/shared/statusBars/AppStatusBar';
import { QuickOpenPalette } from './components/code/shared/QuickOpenPalette';
import { createQuickOpenFileEntries, getRecentQuickOpenFiles, searchQuickOpenFiles, type QuickOpenFileEntry, type QuickOpenSearchResult } from './quickOpen/quickOpenSearch';
import type { WorkspaceRevealRequest } from './workspace/useWorkspaceTree';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { getLeftPanelTargetSizePercent } from './layout/panelSizing';
import { SidebarProvider } from './components/ui/sidebar';

const QUICK_OPEN_RECENT_LIMIT = 20;
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
    mainContentView,
    activeTabId,
    openFile,
    openPreviewFile,
    jumpToLine, jumpTo,
    showLeftPanel, setShowLeftPanel,
    showBottomPanel, setShowBottomPanel,
    showRightPanel, setShowRightPanel,
    cursorLine, cursorCol,
  } = useWorkspace();
  const [isQuickOpenVisible, setIsQuickOpenVisible] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState('');
  const [quickOpenSelectedIndex, setQuickOpenSelectedIndex] = useState(0);
  const [workspaceFiles, setWorkspaceFiles] = useState<QuickOpenFileEntry[] | null>(null);
  const [isQuickOpenLoading, setIsQuickOpenLoading] = useState(false);
  const [quickOpenError, setQuickOpenError] = useState<string | null>(null);
  const [recentQuickOpenFiles, setRecentQuickOpenFiles] = useState<QuickOpenFileEntry[]>([]);
  const [revealRequest, setRevealRequest] = useState<WorkspaceRevealRequest | null>(null);
  const panelGroupContainerRef = useRef<HTMLDivElement | null>(null);
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null);
  const revealTokenRef = useRef(0);

  const syncLeftPanelWidth = useCallback(() => {
    const panelGroupContainer = panelGroupContainerRef.current;
    if (!panelGroupContainer || !showLeftPanel) {
      return;
    }

    const nextSize = getLeftPanelTargetSizePercent(panelGroupContainer.clientWidth);
    leftPanelRef.current?.resize(`${nextSize}%`);
  }, [showLeftPanel]);

  const handleActivityItemSelect = (nextView: string) => {
    setActiveView(nextView as typeof activeView);
  };

  const closeQuickOpen = useCallback(() => {
    setIsQuickOpenVisible(false);
    setQuickOpenQuery('');
    setQuickOpenSelectedIndex(0);
  }, []);

  const openQuickOpen = useCallback(() => {
    setIsQuickOpenVisible(true);
    setQuickOpenQuery('');
    setQuickOpenSelectedIndex(0);
  }, []);

  const invalidateWorkspaceFiles = useCallback(() => {
    setWorkspaceFiles(null);
    setQuickOpenError(null);
  }, []);

  const recordRecentFile = useCallback((filePath: string, fileName: string) => {
    setRecentQuickOpenFiles((current) => {
      const entry = { path: filePath, name: fileName };
      return [entry, ...current.filter((item) => item.path !== filePath)].slice(0, QUICK_OPEN_RECENT_LIMIT);
    });
  }, []);

  const openWorkspaceFile = useCallback((filePath: string, fileName: string) => {
    recordRecentFile(filePath, fileName);
    openFile(filePath, fileName);
  }, [openFile, recordRecentFile]);

  const openWorkspacePreviewFile = useCallback((filePath: string, fileName: string) => {
    recordRecentFile(filePath, fileName);
    openPreviewFile(filePath, fileName);
  }, [openPreviewFile, recordRecentFile]);

  useEffect(() => {
    const panelGroupContainer = panelGroupContainerRef.current;
    if (!panelGroupContainer) {
      return;
    }

    syncLeftPanelWidth();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(syncLeftPanelWidth)
      : null;

    resizeObserver?.observe(panelGroupContainer);
    window.addEventListener('resize', syncLeftPanelWidth);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncLeftPanelWidth);
    };
  }, [syncLeftPanelWidth]);

  useEffect(() => {
    if (showLeftPanel && canToggleLayoutPanels) {
      syncLeftPanelWidth();
    }
  }, [canToggleLayoutPanels, showLeftPanel, syncLeftPanelWidth]);

  useEffect(() => {
    if (!isQuickOpenVisible || workspaceFiles !== null) {
      return;
    }

    const fsApi = window.electronAPI?.fs;
    if (!fsApi) {
      setQuickOpenError('Filesystem API unavailable');
      return;
    }

    let cancelled = false;
    setIsQuickOpenLoading(true);
    setQuickOpenError(null);

    void fsApi.listFiles('.')
      .then((paths) => {
        if (cancelled) {
          return;
        }

        setWorkspaceFiles(createQuickOpenFileEntries(paths));
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setQuickOpenError(error instanceof Error ? error.message : 'Unable to index workspace files');
      })
      .finally(() => {
        if (!cancelled) {
          setIsQuickOpenLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isQuickOpenVisible, workspaceFiles]);

  const isQuickOpenRecentMode = quickOpenQuery.trim().length === 0;

  const quickOpenResults = useMemo(() => {
    if (isQuickOpenRecentMode) {
      return getRecentQuickOpenFiles(recentQuickOpenFiles, workspaceFiles);
    }

    return searchQuickOpenFiles(workspaceFiles ?? [], quickOpenQuery);
  }, [isQuickOpenRecentMode, quickOpenQuery, recentQuickOpenFiles, workspaceFiles]);

  useEffect(() => {
    setQuickOpenSelectedIndex((current) => {
      if (quickOpenResults.length === 0) {
        return 0;
      }

      return Math.min(current, quickOpenResults.length - 1);
    });
  }, [quickOpenResults]);

  const handleQuickOpenSelect = useCallback((result: QuickOpenSearchResult) => {
    revealTokenRef.current += 1;
    setRevealRequest({ path: result.path, token: revealTokenRef.current });
    openWorkspaceFile(result.path, result.name);
    closeQuickOpen();
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
  }) => (
    <CodeWorkspaceShell
      shellTestId={shellTestId}
      activityBar={activityBar}
      overlay={overlay}
      containerRef={panelGroupContainerRef}
      leftPanelRef={leftPanelRef}
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
    />
  );

  const renderExplorerWorkspace = () => (
    renderWorkspaceShell({
      leftPanelId: 'left-panel',
      centerPanelId: 'center-panel',
      topPanelId: 'editor-panel',
      bottomPanelId: 'bottom-panel',
      rightPanelId: 'right-panel',
      leftContent: (
        <LeftSidePanel
          activeFileId={activeTabId}
          onFileOpen={openWorkspaceFile}
          onFilePreview={openWorkspacePreviewFile}
          onLineJump={jumpTo}
          currentOutlineId={activeTabId}
          revealRequest={revealRequest}
          onWorkspaceRefresh={invalidateWorkspaceFiles}
        />
      ),
      topContent: <EditorSplitLayout jumpToLine={jumpToLine} />,
      bottomContent: <BottomPanel onClose={() => setShowBottomPanel(false)} />,
      rightContent: (
        <RightSidePanel
          onFileOpen={openWorkspaceFile}
          onLineJump={jumpTo}
        />
      ),
      overlay: (
        <QuickOpenPalette
          isOpen={isQuickOpenVisible}
          mode={isQuickOpenRecentMode ? 'recent' : 'search'}
          query={quickOpenQuery}
          results={quickOpenResults}
          selectedIndex={quickOpenSelectedIndex}
          isLoading={isQuickOpenLoading}
          errorMessage={quickOpenError}
          emptyMessage={isQuickOpenRecentMode ? 'No recently opened files' : 'No matching files'}
          onClose={closeQuickOpen}
          onQueryChange={setQuickOpenQuery}
          onSelectedIndexChange={setQuickOpenSelectedIndex}
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'p') {
        event.preventDefault();

        if (isQuickOpenVisible) {
          closeQuickOpen();
          return;
        }

        openQuickOpen();
        return;
      }

      if (key === 'j') {
        if (!canToggleLayoutPanels) {
          return;
        }

        event.preventDefault();
        setShowBottomPanel(!showBottomPanel);
        return;
      }

      if (key === 'b') {
        if (!canToggleLayoutPanels) {
          return;
        }

        event.preventDefault();
        setShowLeftPanel(!showLeftPanel);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [canToggleLayoutPanels, closeQuickOpen, isQuickOpenVisible, openQuickOpen, setShowBottomPanel, setShowLeftPanel, showBottomPanel, showLeftPanel]);

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
        onToggleLeftPanel={() => setShowLeftPanel(!showLeftPanel)}
        onToggleBottomPanel={() => setShowBottomPanel(!showBottomPanel)}
        onToggleRightPanel={() => setShowRightPanel(!showRightPanel)}
      />

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