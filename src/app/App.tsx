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

// ─── AppLayout (consumes context) ────────────────────────────────────────────
function AppLayout() {
  const {
    activeView, setActiveView,
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
    if (!panelGroupContainer) {
      return;
    }

    const nextSize = getLeftPanelTargetSizePercent(panelGroupContainer.clientWidth);
    leftPanelRef.current?.resize(`${nextSize}%`);
  }, []);

  const handleActivityItemSelect = (nextView: string) => {
    if (nextView === activeView) {
      setShowLeftPanel(!showLeftPanel);
      return;
    }

    setActiveView(nextView);
    if (!showLeftPanel) {
      setShowLeftPanel(true);
    }
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
    if (showLeftPanel) {
      syncLeftPanelWidth();
    }
  }, [showLeftPanel, syncLeftPanelWidth]);

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
    if (showLeftPanel) {
      setActiveView('explorer');
    }

    revealTokenRef.current += 1;
    setRevealRequest({ path: result.path, token: revealTokenRef.current });
    openWorkspaceFile(result.path, result.name);
    closeQuickOpen();
  }, [closeQuickOpen, openWorkspaceFile, setActiveView, showLeftPanel]);

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
        event.preventDefault();
        setShowBottomPanel(!showBottomPanel);
        return;
      }

      if (key === 'b') {
        event.preventDefault();
        setShowLeftPanel(!showLeftPanel);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeQuickOpen, isQuickOpenVisible, openQuickOpen, setShowBottomPanel, setShowLeftPanel, showBottomPanel, showLeftPanel]);

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

      {mainContentView === 'code' ? (
      <>
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar
          activeView={activeView}
          onItemSelect={handleActivityItemSelect}
          isLeftSidebarHidden={!showLeftPanel}
        />

        <div ref={panelGroupContainerRef} className="flex-1 min-w-0">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel panelRef={leftPanelRef} defaultSize={18} minSize={12} maxSize={35} id="left-panel" collapsed={!showLeftPanel}>
            {showLeftPanel ? (
              <LeftSidePanel
                activeFileId={activeTabId}
                onFileOpen={openWorkspaceFile}
                onFilePreview={openWorkspacePreviewFile}
                onLineJump={jumpTo}
                currentOutlineId={activeTabId}
                revealRequest={revealRequest}
                onWorkspaceRefresh={invalidateWorkspaceFiles}
              />
            ) : (
              <div className="h-full" />
            )}
          </ResizablePanel>

          <ResizableHandle hidden={!showLeftPanel} />

          <ResizablePanel defaultSize={55} minSize={30} id="center-panel">
            <div className="relative h-full">
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

              <ResizablePanelGroup orientation="vertical">
                <ResizablePanel defaultSize={60} minSize={25} id="editor-panel">
                  <EditorSplitLayout jumpToLine={jumpToLine} />
                </ResizablePanel>

                <ResizableHandle hidden={!showBottomPanel} />
                <ResizablePanel defaultSize={40} minSize={15} maxSize={60} id="bottom-panel" collapsed={!showBottomPanel}>
                  {showBottomPanel ? (
                    <BottomPanel onClose={() => setShowBottomPanel(false)} />
                  ) : (
                    <div className="h-full" />
                  )}
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </ResizablePanel>

          <ResizableHandle hidden={!showRightPanel} />

          <ResizablePanel defaultSize={22} minSize={18} maxSize={45} id="right-panel" collapsed={!showRightPanel}>
            {showRightPanel ? (
              <RightSidePanel
                onFileOpen={openWorkspaceFile}
                onLineJump={jumpTo}
              />
            ) : (
              <div className="h-full" />
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
        </div>
      </div>

      <StatusBar
        activeFileId={activeTabId}
        cursorLine={cursorLine}
        cursorCol={cursorCol}
      />
      </>
      ) : mainContentView === 'whiteboard' ? (
        <Suspense fallback={<MainContentFallback />}>
          <WhiteboardView />
        </Suspense>
      ) : (
        <Suspense fallback={<MainContentFallback />}>
          <WorkflowPlaceholder />
        </Suspense>
      )}
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