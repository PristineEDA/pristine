import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { MenuBar } from './components/MenuBar';
import { ActivityBar } from './components/ActivityBar';
import { LeftSidePanel } from './components/LeftSidePanel';
import { EditorArea } from './components/EditorArea';
import { RightSidePanel } from './components/RightSidePanel';
import { BottomPanel } from './components/BottomPanel';
import { StatusBar } from './components/StatusBar';
import { QuickOpenPalette } from './components/QuickOpenPalette';
import { createQuickOpenFileEntries, getRecentQuickOpenFiles, searchQuickOpenFiles, type QuickOpenFileEntry, type QuickOpenSearchResult } from './quickOpen/quickOpenSearch';
import type { WorkspaceRevealRequest } from './workspace/useWorkspaceTree';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';

const QUICK_OPEN_RECENT_LIMIT = 20;

// ─── ResizeHandle ────────────────────────────────────────────────────────────
const ResizeHandle = ({ direction = 'vertical' }: { direction?: 'vertical' | 'horizontal' }) => (
  <PanelResizeHandle
    className={`group relative flex items-center justify-center ${
      direction === 'vertical' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'
    } bg-ide-sidebar-bg hover:bg-ide-accent-vivid transition-colors z-10`}
  >
    <div className={`${
      direction === 'vertical' ? 'w-0.5 h-8' : 'h-0.5 w-8'
    } bg-ide-border group-hover:bg-ide-accent-vivid rounded transition-colors`} />
  </PanelResizeHandle>
);

// ─── AppLayout (consumes context) ────────────────────────────────────────────
function AppLayout() {
  const {
    activeView, setActiveView,
    tabs, activeTabId, openFile, closeFile, setActiveTabId,
    jumpToLine, jumpTo, setCursorPos,
    showLeftPanel, setShowLeftPanel,
    showBottomPanel, setShowBottomPanel,
    showRightPanel, setShowRightPanel,
    editorRef,
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
  const revealTokenRef = useRef(0);

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
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();

        if (isQuickOpenVisible) {
          closeQuickOpen();
          return;
        }

        openQuickOpen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeQuickOpen, isQuickOpenVisible, openQuickOpen]);

  return (
    <div className="flex flex-col h-screen bg-ide-bg text-ide-text overflow-hidden">
      <MenuBar
        showLeftPanel={showLeftPanel}
        showBottomPanel={showBottomPanel}
        showRightPanel={showRightPanel}
        onToggleLeftPanel={() => setShowLeftPanel(!showLeftPanel)}
        onToggleBottomPanel={() => setShowBottomPanel(!showBottomPanel)}
        onToggleRightPanel={() => setShowRightPanel(!showRightPanel)}
      />

      <div className="flex flex-1 overflow-hidden">
        <ActivityBar
          activeView={activeView}
          onItemSelect={handleActivityItemSelect}
          isLeftSidebarHidden={!showLeftPanel}
        />

        <PanelGroup direction="horizontal" className="flex-1">
          {showLeftPanel && (
            <>
              <Panel defaultSize={12} minSize={12} maxSize={35} id="left-panel" order={1}>
                <LeftSidePanel
                  activeFileId={activeTabId}
                  onFileOpen={openWorkspaceFile}
                  onLineJump={jumpTo}
                  currentOutlineId={activeTabId}
                  revealRequest={revealRequest}
                  onWorkspaceRefresh={invalidateWorkspaceFiles}
                />
              </Panel>

              <ResizeHandle direction="vertical" />
            </>
          )}

          <Panel defaultSize={55} minSize={30} id="center-panel" order={2}>
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

              <PanelGroup direction="vertical">
                <Panel defaultSize={65} minSize={25} id="editor-panel" order={1}>
                  <EditorArea
                    tabs={tabs}
                    activeTabId={activeTabId}
                    onTabChange={setActiveTabId}
                    onTabClose={closeFile}
                    editorRef={editorRef}
                    jumpToLine={jumpToLine}
                    onCursorChange={setCursorPos}
                  />
                </Panel>

                {showBottomPanel && (
                  <>
                    <PanelResizeHandle
                      className="h-1 group cursor-row-resize bg-ide-sidebar-bg hover:bg-ide-accent-vivid transition-colors z-10"
                    />
                    <Panel defaultSize={35} minSize={15} maxSize={60} id="bottom-panel" order={2}>
                      <BottomPanel onClose={() => setShowBottomPanel(false)} />
                    </Panel>
                  </>
                )}
              </PanelGroup>
            </div>
          </Panel>

          {showRightPanel && (
            <>
              <ResizeHandle direction="vertical" />

              <Panel defaultSize={18} minSize={18} maxSize={45} id="right-panel" order={3}>
                <RightSidePanel
                  onFileOpen={openWorkspaceFile}
                  onLineJump={jumpTo}
                />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

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