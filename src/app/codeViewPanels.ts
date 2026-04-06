export type MainContentView = 'code' | 'whiteboard' | 'workflow';
export type CodeView = 'explorer' | 'simulation' | 'synthesis' | 'physical' | 'factory';

export interface PanelVisibilityState {
  showLeftPanel: boolean;
  showBottomPanel: boolean;
  showRightPanel: boolean;
}

export const EMPTY_PANEL_STATE: PanelVisibilityState = {
  showLeftPanel: false,
  showBottomPanel: false,
  showRightPanel: false,
};

export const DEFAULT_PANEL_STATE_BY_CODE_VIEW: Record<CodeView, PanelVisibilityState> = {
  explorer: {
    showLeftPanel: false,
    showBottomPanel: false,
    showRightPanel: false,
  },
  simulation: {
    showLeftPanel: true,
    showBottomPanel: true,
    showRightPanel: true,
  },
  synthesis: EMPTY_PANEL_STATE,
  physical: EMPTY_PANEL_STATE,
  factory: EMPTY_PANEL_STATE,
};

export function codeViewSupportsPanels(view: CodeView): boolean {
  return view === 'explorer' || view === 'simulation';
}

export function canToggleLayoutPanels(mainContentView: MainContentView, activeView: CodeView): boolean {
  return mainContentView === 'code' && codeViewSupportsPanels(activeView);
}