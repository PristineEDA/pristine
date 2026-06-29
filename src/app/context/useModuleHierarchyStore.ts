import { create } from 'zustand';
import type { ModuleHierarchyTop } from './ModuleHierarchyContext';

interface ModuleHierarchyStoreState {
  top: ModuleHierarchyTop | null;
}

interface ModuleHierarchyStoreActions {
  resetTop: () => void;
  setTop: (top: ModuleHierarchyTop | null) => void;
}

export type ModuleHierarchyStore = ModuleHierarchyStoreState & ModuleHierarchyStoreActions;

export const useModuleHierarchyStore = create<ModuleHierarchyStore>((set) => ({
  top: null,

  resetTop: () => {
    set({ top: null });
  },

  setTop: (top) => {
    set((state) => (state.top === top ? state : { top }));
  },
}));

export function resetModuleHierarchyStoreForTests(): void {
  useModuleHierarchyStore.setState({ top: null });
}
