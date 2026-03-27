import { useState, useRef, useCallback } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { MenuBar } from './components/MenuBar';
import { ActivityBar } from './components/ActivityBar';
import { LeftSidePanel } from './components/LeftSidePanel';
import { EditorArea } from './components/EditorArea';
import { RightSidePanel } from './components/RightSidePanel';
import { BottomPanel } from './components/BottomPanel';
import { StatusBar } from './components/StatusBar';

interface Tab {
  id: string;
  name: string;
  modified?: boolean;
}

const DEFAULT_TABS: Tab[] = [
  { id: 'uart_tx', name: 'uart_tx.v' },
  { id: 'alu', name: 'alu.v' },
  { id: 'cpu_top', name: 'cpu_top.v', modified: true },
];

export default function App() {
  const [activeView, setActiveView] = useState('explorer');
  const [tabs, setTabs] = useState<Tab[]>(DEFAULT_TABS);
  const [activeTabId, setActiveTabId] = useState('uart_tx');
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [jumpToLine, setJumpToLine] = useState<number | undefined>();
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const editorRef = useRef<any>(null);

  // Open a file by id/name
  const handleFileOpen = useCallback((fileId: string, fileName: string) => {
    setTabs((prev) => {
      const existing = prev.find((t) => t.id === fileId);
      if (existing) return prev;
      return [...prev, { id: fileId, name: fileName }];
    });
    setActiveTabId(fileId);
  }, []);

  // Close a tab
  const handleTabClose = useCallback((fileId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === fileId);
      const next = prev.filter((t) => t.id !== fileId);
      if (fileId === activeTabId && next.length > 0) {
        const newActive = next[Math.min(idx, next.length - 1)];
        setActiveTabId(newActive.id);
      }
      return next;
    });
  }, [activeTabId]);

  // Jump to line in editor
  const handleLineJump = useCallback((line: number) => {
    setJumpToLine(line);
    setTimeout(() => setJumpToLine(undefined), 100);
  }, []);

  // Track cursor position
  const handleEditorMount = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.onDidChangeCursorPosition((e: any) => {
        setCursorLine(e.position.lineNumber);
        setCursorCol(e.position.column);
      });
    }
  }, []);

  // Resize handle style
  const ResizeHandle = ({ direction = 'vertical' }: { direction?: 'vertical' | 'horizontal' }) => (
    <PanelResizeHandle
      className={`group relative flex items-center justify-center ${
        direction === 'vertical' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'
      } bg-[#252526] hover:bg-[#007acc] transition-colors z-10`}
    >
      <div className={`${
        direction === 'vertical' ? 'w-0.5 h-8' : 'h-0.5 w-8'
      } bg-[#3d3d3d] group-hover:bg-[#007acc] rounded transition-colors`} />
    </PanelResizeHandle>
  );

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-[#cccccc] overflow-hidden">
      {/* Menu bar */}
      <MenuBar />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Activity bar */}
        <ActivityBar activeView={activeView} onViewChange={setActiveView} />

        {/* Horizontal panel group: left | center | right */}
        <PanelGroup direction="horizontal" className="flex-1">

          {/* ── Left Side Panel ── */}
          <Panel defaultSize={12} minSize={12} maxSize={35} id="left-panel" order={1}>
            <LeftSidePanel
              activeFileId={activeTabId}
              onFileOpen={handleFileOpen}
              onLineJump={handleLineJump}
              currentOutlineId={activeTabId}
            />
          </Panel>

          <ResizeHandle direction="vertical" />

          {/* ── Center: Editor + Bottom Panel (vertical split) ── */}
          <Panel defaultSize={55} minSize={30} id="center-panel" order={2}>
            <PanelGroup direction="vertical">
              {/* Editor area */}
              <Panel defaultSize={65} minSize={25} id="editor-panel" order={1}>
                <EditorArea
                  tabs={tabs}
                  activeTabId={activeTabId}
                  onTabChange={setActiveTabId}
                  onTabClose={handleTabClose}
                  editorRef={editorRef}
                  jumpToLine={jumpToLine}
                  onCursorChange={(line, col) => { setCursorLine(line); setCursorCol(col); }}
                />
              </Panel>

              {/* Bottom panel (terminal etc.) */}
              {showBottomPanel && (
                <>
                  <PanelResizeHandle
                    className="h-1 group cursor-row-resize bg-[#252526] hover:bg-[#007acc] transition-colors z-10"
                  />
                  <Panel defaultSize={35} minSize={15} maxSize={60} id="bottom-panel" order={2}>
                    <BottomPanel onClose={() => setShowBottomPanel(false)} />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          <ResizeHandle direction="vertical" />

          {/* ── Right Side Panel ── */}
          <Panel defaultSize={18} minSize={18} maxSize={45} id="right-panel" order={3}>
            <RightSidePanel
              onFileOpen={handleFileOpen}
              onLineJump={handleLineJump}
            />
          </Panel>

        </PanelGroup>
      </div>

      {/* Status bar */}
      <StatusBar
        activeFileId={activeTabId}
        cursorLine={cursorLine}
        cursorCol={cursorCol}
      />
    </div>
  );
}