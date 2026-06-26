import type { CodeView, MainContentView, PanelVisibilityState } from '../src/app/codeViewPanels';
import type { EditorGroup, EditorLayoutNode } from '../src/app/editor/editorLayout';

export interface ProjectSessionSnapshot {
  activeTabId?: string;
  activeView: CodeView;
  editorGroups: EditorGroup[];
  editorLayout: EditorLayoutNode | null;
  focusedGroupId: string | null;
  mainContentView: MainContentView;
  panelStateByView: Record<CodeView, PanelVisibilityState>;
  panelWidths?: Record<string, number>;
  version: 1;
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
