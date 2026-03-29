import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Tab {
  id: string;
  name: string;
  modified?: boolean;
}

interface WorkspaceState {
  activeView: string;
  setActiveView: (view: string) => void;

  tabs: Tab[];
  activeTabId: string;
  openFile: (fileId: string, fileName: string) => void;
  closeFile: (fileId: string) => void;
  setActiveTabId: (id: string) => void;

  jumpToLine: number | undefined;
  jumpTo: (line: number) => void;

  cursorLine: number;
  cursorCol: number;
  setCursorPos: (line: number, col: number) => void;

  showBottomPanel: boolean;
  setShowBottomPanel: (show: boolean) => void;

  editorRef: React.MutableRefObject<any>;
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
  const [activeView, setActiveView] = useState('explorer');
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState('');
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [jumpToLine, setJumpToLine] = useState<number | undefined>();
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const editorRef = useRef<any>(null);

  const openFile = useCallback((fileId: string, fileName: string) => {
    setTabs((prev) => {
      if (prev.find((t) => t.id === fileId)) return prev;
      return [...prev, { id: fileId, name: fileName }];
    });
    setActiveTabId(fileId);
  }, []);

  const closeFile = useCallback((fileId: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === fileId);
      const next = prev.filter((t) => t.id !== fileId);
      if (fileId === activeTabId && next.length > 0) {
        const newActive = next[Math.min(idx, next.length - 1)];
        if (newActive) {
          setActiveTabId(newActive.id);
        }
      } else if (fileId === activeTabId) {
        setActiveTabId('');
      }
      return next;
    });
  }, [activeTabId]);

  const jumpTo = useCallback((line: number) => {
    setJumpToLine(line);
    setTimeout(() => setJumpToLine(undefined), 100);
  }, []);

  const setCursorPos = useCallback((line: number, col: number) => {
    setCursorLine(line);
    setCursorCol(col);
  }, []);

  return (
    <WorkspaceContext.Provider value={{
      activeView, setActiveView,
      tabs, activeTabId, openFile, closeFile, setActiveTabId,
      jumpToLine, jumpTo,
      cursorLine, cursorCol, setCursorPos,
      showBottomPanel, setShowBottomPanel,
      editorRef,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
