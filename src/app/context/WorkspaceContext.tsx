import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  type EditorDropPosition,
  type EditorGroup,
  type EditorLayoutNode,
  type EditorTab,
} from '../editor/editorLayout';
import {
  canToggleLayoutPanels,
  type CodeView,
  DEFAULT_PANEL_STATE_BY_CODE_VIEW,
  EMPTY_PANEL_STATE,
  type MainContentView,
  type PanelVisibilityState,
} from '../codeViewPanels';
import { useWorkspaceEditorState } from './useWorkspaceEditorState';
import { useWorkspaceFileStore } from './useWorkspaceFileStore';

// ─── Types ──────────────────────────────────────────────────────────────────

export type Tab = EditorTab;

interface WorkspaceState {
  activeView: CodeView;
  setActiveView: (view: CodeView) => void;

  mainContentView: MainContentView;
  setMainContentView: (view: MainContentView) => void;
  canToggleLayoutPanels: boolean;

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
  const [activeView, setActiveView] = useState<CodeView>('explorer');
  const [mainContentView, setMainContentView] = useState<MainContentView>('code');
  const [panelStateByView, setPanelStateByView] = useState<Record<CodeView, PanelVisibilityState>>({
    ...DEFAULT_PANEL_STATE_BY_CODE_VIEW,
  });
  const editorWorkspace = useWorkspaceEditorState();
  const fileStore = useWorkspaceFileStore();
  const layoutPanelsEnabled = canToggleLayoutPanels(mainContentView, activeView);
  const visiblePanelState = layoutPanelsEnabled ? panelStateByView[activeView] : EMPTY_PANEL_STATE;

  const setPanelStateForActiveView = (nextState: Partial<PanelVisibilityState>) => {
    if (!layoutPanelsEnabled) {
      return;
    }

    setPanelStateByView((currentState) => ({
      ...currentState,
      [activeView]: {
        ...currentState[activeView],
        ...nextState,
      },
    }));
  };

  useEffect(() => {
    editorWorkspace.syncFocusedEditorRef();
  }, [editorWorkspace]);

  return (
    <WorkspaceContext.Provider value={{
      activeView, setActiveView,
      mainContentView, setMainContentView,
      canToggleLayoutPanels: layoutPanelsEnabled,
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
      showLeftPanel: visiblePanelState.showLeftPanel,
      setShowLeftPanel: (show) => setPanelStateForActiveView({ showLeftPanel: show }),
      showBottomPanel: visiblePanelState.showBottomPanel,
      setShowBottomPanel: (show) => setPanelStateForActiveView({ showBottomPanel: show }),
      showRightPanel: visiblePanelState.showRightPanel,
      setShowRightPanel: (show) => setPanelStateForActiveView({ showRightPanel: show }),
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
