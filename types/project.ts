import type { CodeView, MainContentView, PanelVisibilityState } from '../src/app/codeViewPanels';
import type { EditorGroup, EditorLayoutNode } from '../src/app/editor/editorLayout';

export interface ProjectWindowBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface ProjectWindowState {
  bounds: ProjectWindowBounds | null;
  maximized: boolean;
}

export interface ProjectSidePanelSession {
  leftSplitVisible: boolean;
  physicalLeftSplitVisible: boolean;
  physicalRightSplitVisible: boolean;
  rightSplitVisible: boolean;
}

export interface ProjectBottomPanelSession {
  focusedPaneId: string;
  nextPaneIndex: number;
  panes: ProjectBottomPanelPane[];
}

export type ProjectBottomPanelTabId =
  | 'terminal'
  | 'output'
  | 'problems'
  | 'debug'
  | 'lsp'
  | 'schematic'
  | 'waveform'
  | 'synthesis';

export type ProjectBottomPaneContent =
  | { kind: 'tab'; tab: ProjectBottomPanelTabId }
  | { kind: 'empty' }
  | { kind: 'placeholder'; label: string; icon: 'file' | 'boxes' };

export interface ProjectBottomPanelPane {
  content: ProjectBottomPaneContent;
  id: string;
  size: number;
}

export interface ProjectSessionSnapshot {
  activeTabId?: string;
  activeView: CodeView;
  bottomPanelSession?: ProjectBottomPanelSession;
  editorGroups: EditorGroup[];
  editorLayout: EditorLayoutNode | null;
  focusedGroupId: string | null;
  mainContentView: MainContentView;
  panelStateByView: Record<CodeView, PanelVisibilityState>;
  panelWidths?: Record<string, number>;
  sidePanelSession?: ProjectSidePanelSession;
  version: 1;
  windowState?: ProjectWindowState;
}

export interface ProjectState {
  name: string;
  rootPath: string;
  session: ProjectSessionSnapshot | null;
}

export interface CreateProjectInput {
  name: string;
  path: string;
  mode: string;
  process: string;
  type: string;
  mgnt: string;
  padframe: string;
}

export interface ProjectCreateResult {
  project: ProjectState;
}

export interface ProjectOpenResult {
  project: ProjectState;
}

export interface ProjectCloseResult {
  closed: boolean;
}

export type ProjectChangedEvent = ProjectState | null;
