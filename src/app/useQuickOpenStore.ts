import { create } from 'zustand';
import type { QuickOpenFileEntry } from './quickOpen/quickOpenSearch';
import type { WorkspaceRevealRequest } from './workspace/useWorkspaceTree';

export const QUICK_OPEN_RECENT_LIMIT = 20;

export interface QuickOpenState {
  errorMessage: string | null;
  isLoading: boolean;
  isVisible: boolean;
  query: string;
  recentFiles: QuickOpenFileEntry[];
  revealRequest: WorkspaceRevealRequest | null;
  selectedIndex: number;
  workspaceFiles: QuickOpenFileEntry[] | null;
}

interface QuickOpenActions {
  clampSelectedIndex: (resultCount: number) => void;
  closeQuickOpenState: () => void;
  failIndexing: (errorMessage: string) => void;
  finishIndexing: (files: QuickOpenFileEntry[]) => void;
  invalidateWorkspaceFiles: () => void;
  openQuickOpenState: () => void;
  recordRecentFile: (filePath: string, fileName: string) => void;
  resetQuickOpenStoreForTests: () => void;
  setQuery: (query: string) => void;
  setRevealRequest: (revealRequest: WorkspaceRevealRequest) => void;
  setSelectedIndex: (index: number) => void;
  startIndexing: () => void;
}

export type QuickOpenStore = QuickOpenState & QuickOpenActions;

function createDefaultQuickOpenState(): QuickOpenState {
  return {
    errorMessage: null,
    isLoading: false,
    isVisible: false,
    query: '',
    recentFiles: [],
    revealRequest: null,
    selectedIndex: 0,
    workspaceFiles: null,
  };
}

export const useQuickOpenStore = create<QuickOpenStore>((set) => ({
  ...createDefaultQuickOpenState(),

  clampSelectedIndex: (resultCount) => {
    set((state) => {
      const nextSelectedIndex = resultCount === 0
        ? 0
        : Math.min(state.selectedIndex, resultCount - 1);

      return state.selectedIndex === nextSelectedIndex ? state : { selectedIndex: nextSelectedIndex };
    });
  },

  closeQuickOpenState: () => {
    set({
      isVisible: false,
      query: '',
      selectedIndex: 0,
    });
  },

  failIndexing: (errorMessage) => {
    set({
      errorMessage,
      isLoading: false,
    });
  },

  finishIndexing: (files) => {
    set({
      isLoading: false,
      workspaceFiles: files,
    });
  },

  invalidateWorkspaceFiles: () => {
    set({
      errorMessage: null,
      workspaceFiles: null,
    });
  },

  openQuickOpenState: () => {
    set({
      isVisible: true,
      query: '',
      selectedIndex: 0,
    });
  },

  recordRecentFile: (filePath, fileName) => {
    set((state) => {
      const entry = { name: fileName, path: filePath };
      return {
        recentFiles: [
          entry,
          ...state.recentFiles.filter((item) => item.path !== filePath),
        ].slice(0, QUICK_OPEN_RECENT_LIMIT),
      };
    });
  },

  resetQuickOpenStoreForTests: () => {
    set(createDefaultQuickOpenState());
  },

  setQuery: (query) => {
    set((state) => (state.query === query ? state : { query }));
  },

  setRevealRequest: (revealRequest) => {
    set({ revealRequest });
  },

  setSelectedIndex: (index) => {
    set((state) => (state.selectedIndex === index ? state : { selectedIndex: index }));
  },

  startIndexing: () => {
    set({
      errorMessage: null,
      isLoading: true,
    });
  },
}));

export function resetQuickOpenStoreForTests(): void {
  useQuickOpenStore.getState().resetQuickOpenStoreForTests();
}
