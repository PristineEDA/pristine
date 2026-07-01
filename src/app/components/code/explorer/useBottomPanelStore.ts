import { create } from 'zustand';
import type { ProjectBottomPanelSession } from '../../../../../types/project';
import type { TerminalProfile } from './terminalSessionStore';

export type BottomPanelTabId = 'terminal' | 'output' | 'problems' | 'debug' | 'lsp' | 'schematic' | 'waveform' | 'synthesis';

export type BottomPaneContent =
  | { kind: 'tab'; tab: BottomPanelTabId; terminalProfile?: TerminalProfile }
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
  captureProjectBottomPanelSession: () => ProjectBottomPanelSession;
  focusPane: (paneId: string, measuredWidth?: number) => void;
  hydrateProjectBottomPanelSession: (snapshot: ProjectBottomPanelSession | null | undefined) => void;
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

const VALID_BOTTOM_PANEL_TABS = new Set<BottomPanelTabId>([
  'terminal',
  'output',
  'problems',
  'debug',
  'lsp',
  'schematic',
  'waveform',
  'synthesis',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeBottomPaneContent(value: unknown): BottomPaneContent {
  if (!isPlainObject(value)) {
    return { kind: 'empty' };
  }

  if (value['kind'] === 'tab' && typeof value['tab'] === 'string' && VALID_BOTTOM_PANEL_TABS.has(value['tab'] as BottomPanelTabId)) {
    return { kind: 'tab', tab: value['tab'] as BottomPanelTabId };
  }

  if (value['kind'] === 'placeholder') {
    const label = typeof value['label'] === 'string' && value['label'].trim().length > 0
      ? value['label']
      : 'Placeholder';
    const icon = value['icon'] === 'boxes' ? 'boxes' : 'file';
    return { kind: 'placeholder', icon, label };
  }

  return { kind: 'empty' };
}

function normalizeHydratedBottomPanelSession(
  snapshot: ProjectBottomPanelSession | null | undefined,
): BottomPanelState {
  if (!isPlainObject(snapshot) || !Array.isArray(snapshot.panes)) {
    return createDefaultBottomPanelState();
  }

  const seenPaneIds = new Set<string>();
  const panes = snapshot.panes
    .map((pane, index): BottomPanelPane | null => {
      if (!isPlainObject(pane)) {
        return null;
      }

      const fallbackId = `bottom-pane-${index + 1}`;
      const id = typeof pane['id'] === 'string' && pane['id'].trim().length > 0
        ? pane['id']
        : fallbackId;

      if (seenPaneIds.has(id)) {
        return null;
      }
      seenPaneIds.add(id);

      const size = typeof pane['size'] === 'number' && Number.isFinite(pane['size']) && pane['size'] > 0
        ? pane['size']
        : 100;

      return {
        content: normalizeBottomPaneContent(pane['content']),
        id,
        size,
      };
    })
    .filter((pane): pane is BottomPanelPane => Boolean(pane));

  if (panes.length === 0) {
    return createDefaultBottomPanelState();
  }

  const normalizedPanes = normalizeBottomPaneSizes(panes);
  const focusedPaneId = typeof snapshot.focusedPaneId === 'string'
    && normalizedPanes.some((pane) => pane.id === snapshot.focusedPaneId)
    ? snapshot.focusedPaneId
    : normalizedPanes[0]?.id ?? 'bottom-pane-1';
  const nextPaneIndex = typeof snapshot.nextPaneIndex === 'number'
    && Number.isInteger(snapshot.nextPaneIndex)
    && snapshot.nextPaneIndex > normalizedPanes.length
    ? snapshot.nextPaneIndex
    : normalizedPanes.length + 1;

  return {
    focusedPaneId,
    focusedPaneMeasuredWidth: Number.POSITIVE_INFINITY,
    nextPaneIndex,
    panes: normalizedPanes,
  };
}

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

  captureProjectBottomPanelSession: () => {
    const state = get();
    return {
      focusedPaneId: state.focusedPaneId,
      nextPaneIndex: state.nextPaneIndex,
      panes: state.panes.map((pane) => ({
        content: pane.content.kind === 'tab' && pane.content.tab === 'terminal'
          ? { kind: 'tab', tab: 'terminal' }
          : { ...pane.content },
        id: pane.id,
        size: pane.size,
      })),
    };
  },

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

  hydrateProjectBottomPanelSession: (snapshot) => {
    set(normalizeHydratedBottomPanelSession(snapshot));
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
