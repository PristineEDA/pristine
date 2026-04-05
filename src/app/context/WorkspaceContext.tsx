import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  type EditorDropPosition,
  type EditorGroup,
  type EditorLayoutNode,
  type EditorTab,
} from '../editor/editorLayout';
import { useWorkspaceEditorState } from './useWorkspaceEditorState';
import { useWorkspaceFileStore } from './useWorkspaceFileStore';

// ─── Types ──────────────────────────────────────────────────────────────────

export type Tab = EditorTab;

export type MainContentView = 'code' | 'whiteboard' | 'workflow';

interface WorkspaceState {
  activeView: string;
  setActiveView: (view: string) => void;

  mainContentView: MainContentView;
  setMainContentView: (view: MainContentView) => void;

  editorGroups: EditorGroup[];
  editorLayout: EditorLayoutNode | null;
  focusedGroupId: string | null;
  focusGroup: (groupId: string) => void;
  splitGroup: (groupId: string, direction?: 'horizontal' | 'vertical') => void;
  moveTab: (sourceGroupId: string, tabId: string, targetGroupId: string, position: EditorDropPosition) => void;

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
  setCursorPos: (line: number, col: number, groupId?: string) => void;

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

  editorRef: React.MutableRefObject<any>;
  registerEditorRef: (groupId: string, editorInstance: any) => void;
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
  const [mainContentView, setMainContentView] = useState<MainContentView>('code');
  const [showLeftPanel, setShowLeftPanel] = useState(false);
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const editorWorkspace = useWorkspaceEditorState();
  const fileStore = useWorkspaceFileStore();

  useEffect(() => {
    editorWorkspace.syncFocusedEditorRef();
  }, [editorWorkspace]);

  return (
    <WorkspaceContext.Provider value={{
      activeView, setActiveView,
      mainContentView, setMainContentView,
      editorGroups: editorWorkspace.editorGroups,
      editorLayout: editorWorkspace.editorLayout,
      focusedGroupId: editorWorkspace.focusedGroupId,
      focusGroup: editorWorkspace.focusGroup,
      splitGroup: editorWorkspace.splitGroup,
      moveTab: editorWorkspace.moveTab,
      tabs: editorWorkspace.tabs,
      activeTabId: editorWorkspace.activeTabId,
      openFile: editorWorkspace.openFile,
      openFileInGroup: editorWorkspace.openFileInGroup,
      openPreviewFile: editorWorkspace.openPreviewFile,
      openPreviewFileInGroup: editorWorkspace.openPreviewFileInGroup,
      pinTab: editorWorkspace.pinTab,
      pinTabInGroup: editorWorkspace.pinTabInGroup,
      closeFile: editorWorkspace.closeFile,
      closeFileInGroup: editorWorkspace.closeFileInGroup,
      setActiveTabId: editorWorkspace.setActiveTabId,
      setActiveTabIdInGroup: editorWorkspace.setActiveTabIdInGroup,
      jumpToLine: editorWorkspace.jumpToLine,
      jumpTo: editorWorkspace.jumpTo,
      cursorLine: editorWorkspace.cursorLine,
      cursorCol: editorWorkspace.cursorCol,
      setCursorPos: editorWorkspace.setCursorPos,
      showLeftPanel, setShowLeftPanel,
      showBottomPanel, setShowBottomPanel,
      showRightPanel, setShowRightPanel,
      fileContents: fileStore.fileContents,
      loadingFiles: fileStore.loadingFiles,
      loadErrors: fileStore.loadErrors,
      loadFileContent: fileStore.loadFileContent,
      updateFileContent: fileStore.updateFileContent,
      editorRef: editorWorkspace.editorRef,
      registerEditorRef: editorWorkspace.registerEditorRef,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
