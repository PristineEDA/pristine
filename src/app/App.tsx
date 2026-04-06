import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle, type PanelImperativeHandle } from './components/ui/resizable';
import { MenuBar } from './components/MenuBar';
import { ActivityBar } from './components/ActivityBar';
import { LeftSidePanel } from './components/LeftSidePanel';
import { EditorSplitLayout } from './components/EditorSplitLayout';
import { RightSidePanel } from './components/RightSidePanel';
import { BottomPanel } from './components/BottomPanel';
import { StatusBar } from './components/StatusBar';
import { QuickOpenPalette } from './components/QuickOpenPalette';
import { createQuickOpenFileEntries, getRecentQuickOpenFiles, searchQuickOpenFiles, type QuickOpenFileEntry, type QuickOpenSearchResult } from './quickOpen/quickOpenSearch';
import type { WorkspaceRevealRequest } from './workspace/useWorkspaceTree';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { getLeftPanelTargetSizePercent } from './layout/panelSizing';

const QUICK_OPEN_RECENT_LIMIT = 20;
const WhiteboardView = lazy(() => import('./components/whiteboard/WhiteboardView').then((module) => ({ default: module.WhiteboardView })));
const WorkflowPlaceholder = lazy(() => import('./components/WorkflowPlaceholder').then((module) => ({ default: module.WorkflowPlaceholder })));

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
    <WorkflowPlaceholder title={title} testId={testId} />
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
    includeQuickOpen = false,
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
    includeQuickOpen?: boolean;
  }) => (
    <div data-testid={shellTestId} className="flex flex-1 overflow-hidden">
      <ActivityBar
        activeView={activeView}
        onItemSelect={handleActivityItemSelect}
      />

      <div ref={panelGroupContainerRef} className="flex-1 min-w-0">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel panelRef={leftPanelRef} defaultSize={18} minSize={12} maxSize={35} id={leftPanelId} collapsed={!showLeftPanel}>
            {showLeftPanel ? leftContent : <div className="h-full" />}
          </ResizablePanel>

          <ResizableHandle hidden={!showLeftPanel} />

          <ResizablePanel defaultSize={55} minSize={30} id={centerPanelId}>
            <div className="relative h-full">
              {includeQuickOpen && (
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
              )}

              <ResizablePanelGroup orientation="vertical">
                <ResizablePanel defaultSize={60} minSize={25} id={topPanelId}>
                  {topContent}
                </ResizablePanel>

                <ResizableHandle hidden={!showBottomPanel} />
                <ResizablePanel defaultSize={40} minSize={15} maxSize={60} id={bottomPanelId} collapsed={!showBottomPanel}>
                  {showBottomPanel ? bottomContent : <div className="h-full" />}
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>

          <ResizableHandle hidden={!showRightPanel} />

          <ResizablePanel defaultSize={22} minSize={18} maxSize={45} id={rightPanelId} collapsed={!showRightPanel}>
            {showRightPanel ? rightContent : <div className="h-full" />}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
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
      includeQuickOpen: true,
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
            <WorkflowPlaceholder title={placeholder.title} testId={placeholder.testId} />
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
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
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
              <WorkflowPlaceholder />
            </Suspense>
          </div>
        )}

      <StatusBar
        activeFileId={activeTabId}
        cursorLine={cursorLine}
        cursorCol={cursorCol}
      />
    </div>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <AppLayout />
    </WorkspaceProvider>
  );
}