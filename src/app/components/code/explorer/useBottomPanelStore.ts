import { create } from 'zustand';

export type BottomPanelTabId = 'terminal' | 'output' | 'problems' | 'debug' | 'lsp' | 'schematic' | 'waveform' | 'synthesis';

export type BottomPaneContent =
  | { kind: 'tab'; tab: BottomPanelTabId }
  | { kind: 'empty' }
  | { kind: 'placeholder'; label: string; icon: 'file' | 'boxes' };

export interface BottomPanelPane {
  id: string;
  content: BottomPaneContent;
  size: number;
}

export const MIN_SPLIT_PANE_WIDTH_PX = 260;
export const SPLIT_HANDLE_GAP_PX = 4;

export interface RemovedBottomPanelPane {
  pane: BottomPanelPane;
  nextFocusedPaneId: string;
}

interface BottomPanelState {
  focusedPaneId: string;
  focusedPaneMeasuredWidth: number;
  nextPaneIndex: number;
  panes: BottomPanelPane[];
}

interface BottomPanelActions {
  focusPane: (paneId: string, measuredWidth?: number) => void;
  removeFocusedPane: () => RemovedBottomPanelPane | null;
  resetBottomPanelPanes: () => void;
  setFocusedPaneMeasuredWidth: (measuredWidth: number) => void;
  setFocusedPaneTab: (tab: BottomPanelTabId, measuredWidth?: number) => void;
  setPaneSize: (paneId: string, size: number) => void;
  splitFocusedPane: (measuredWidth: number) => boolean;
  updatePaneContent: (paneId: string, content: BottomPaneContent, measuredWidth?: number) => void;
}

export type BottomPanelStore = BottomPanelState & BottomPanelActions;

export const createInitialBottomPanelPane = (): BottomPanelPane => ({
  content: { kind: 'tab', tab: 'terminal' },
  id: 'bottom-pane-1',
  size: 100,
});

export function normalizeBottomPaneSizes(panes: BottomPanelPane[]): BottomPanelPane[] {
  const total = panes.reduce((sum, pane) => sum + pane.size, 0);
  if (total <= 0) {
    const fallbackSize = 100 / panes.length;
    return panes.map((pane) => ({ ...pane, size: fallbackSize }));
  }

  return panes.map((pane) => ({ ...pane, size: (pane.size / total) * 100 }));
}

function createDefaultBottomPanelState(): BottomPanelState {
  return {
    focusedPaneId: 'bottom-pane-1',
    focusedPaneMeasuredWidth: Number.POSITIVE_INFINITY,
    nextPaneIndex: 2,
    panes: [createInitialBottomPanelPane()],
  };
}

function canSplitMeasuredWidth(measuredWidth: number): boolean {
  return measuredWidth >= (MIN_SPLIT_PANE_WIDTH_PX * 2 + SPLIT_HANDLE_GAP_PX);
}

export const useBottomPanelStore = create<BottomPanelStore>((set, get) => ({
  ...createDefaultBottomPanelState(),

  focusPane: (paneId, measuredWidth) => {
    set((state) => {
      if (!state.panes.some((pane) => pane.id === paneId)) {
        return state;
      }

      return {
        focusedPaneId: paneId,
        focusedPaneMeasuredWidth: measuredWidth ?? state.focusedPaneMeasuredWidth,
      };
    });
  },

  removeFocusedPane: () => {
    const state = get();
    if (state.panes.length <= 1) {
      return null;
    }

    const focusedIndex = state.panes.findIndex((pane) => pane.id === state.focusedPaneId);
    if (focusedIndex < 0) {
      return null;
    }

    const removedPane = state.panes[focusedIndex];
    if (!removedPane) {
      return null;
    }

    const nextPanes = normalizeBottomPaneSizes(state.panes.filter((pane) => pane.id !== removedPane.id));
    const nextFocusedPane = nextPanes[Math.min(focusedIndex, nextPanes.length - 1)] ?? nextPanes[0];
    if (!nextFocusedPane) {
      return null;
    }

    set({
      focusedPaneId: nextFocusedPane.id,
      focusedPaneMeasuredWidth: Number.POSITIVE_INFINITY,
      panes: nextPanes,
    });

    return {
      nextFocusedPaneId: nextFocusedPane.id,
      pane: removedPane,
    };
  },

  resetBottomPanelPanes: () => {
    set(createDefaultBottomPanelState());
  },

  setFocusedPaneMeasuredWidth: (measuredWidth) => {
    set({ focusedPaneMeasuredWidth: measuredWidth });
  },

  setFocusedPaneTab: (tab, measuredWidth) => {
    get().updatePaneContent(get().focusedPaneId, { kind: 'tab', tab }, measuredWidth);
  },

  setPaneSize: (paneId, size) => {
    set((state) => {
      const pane = state.panes.find((currentPane) => currentPane.id === paneId);
      if (!pane || Math.abs(pane.size - size) < 0.001) {
        return state;
      }

      return {
        panes: state.panes.map((currentPane) => (
          currentPane.id === paneId ? { ...currentPane, size } : currentPane
        )),
      };
    });
  },

  splitFocusedPane: (measuredWidth) => {
    if (!canSplitMeasuredWidth(measuredWidth)) {
      return false;
    }

    const state = get();
    const focusedIndex = state.panes.findIndex((pane) => pane.id === state.focusedPaneId);
    if (focusedIndex < 0) {
      return false;
    }

    const focusedPane = state.panes[focusedIndex];
    if (!focusedPane) {
      return false;
    }

    const nextPaneId = `bottom-pane-${state.nextPaneIndex}`;
    const halfSize = focusedPane.size / 2;
    const nextPanes = normalizeBottomPaneSizes([
      ...state.panes.slice(0, focusedIndex),
      { ...focusedPane, size: halfSize },
      { content: { kind: 'empty' }, id: nextPaneId, size: halfSize },
      ...state.panes.slice(focusedIndex + 1),
    ]);

    set({
      focusedPaneId: nextPaneId,
      focusedPaneMeasuredWidth: Number.POSITIVE_INFINITY,
      nextPaneIndex: state.nextPaneIndex + 1,
      panes: nextPanes,
    });

    return true;
  },

  updatePaneContent: (paneId, content, measuredWidth) => {
    set((state) => {
      if (!state.panes.some((pane) => pane.id === paneId)) {
        return state;
      }

      return {
        focusedPaneId: paneId,
        focusedPaneMeasuredWidth: measuredWidth ?? state.focusedPaneMeasuredWidth,
        panes: state.panes.map((pane) => (
          pane.id === paneId ? { ...pane, content } : pane
        )),
      };
    });
  },
}));

export function resetBottomPanelStoreForTests(): void {
  useBottomPanelStore.setState(createDefaultBottomPanelState());
}
