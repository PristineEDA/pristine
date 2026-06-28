import { create } from 'zustand';

interface MenuChromeState {
  applicationMenuHoverExpanded: boolean;
  applicationMenuLocked: boolean;
  applicationMenuOpen: boolean;
}

interface MenuChromeActions {
  resetMenuChromeStoreForTests: () => void;
  setApplicationMenuHoverExpanded: (expanded: boolean) => void;
  setApplicationMenuLocked: (locked: boolean) => void;
  setApplicationMenuOpen: (open: boolean) => void;
}

export type MenuChromeStore = MenuChromeState & MenuChromeActions;

function createDefaultMenuChromeState(): MenuChromeState {
  return {
    applicationMenuHoverExpanded: false,
    applicationMenuLocked: false,
    applicationMenuOpen: false,
  };
}

export function isApplicationMenuExpanded(state: Pick<
  MenuChromeState,
  'applicationMenuHoverExpanded' | 'applicationMenuLocked' | 'applicationMenuOpen'
>): boolean {
  return state.applicationMenuLocked || state.applicationMenuHoverExpanded || state.applicationMenuOpen;
}

export const useMenuChromeStore = create<MenuChromeStore>((set) => ({
  ...createDefaultMenuChromeState(),

  resetMenuChromeStoreForTests: () => {
    set(createDefaultMenuChromeState());
  },

  setApplicationMenuHoverExpanded: (expanded) => {
    set((state) => (state.applicationMenuHoverExpanded === expanded ? state : { applicationMenuHoverExpanded: expanded }));
  },

  setApplicationMenuLocked: (locked) => {
    set((state) => (state.applicationMenuLocked === locked ? state : { applicationMenuLocked: locked }));
  },

  setApplicationMenuOpen: (open) => {
    set((state) => (state.applicationMenuOpen === open ? state : { applicationMenuOpen: open }));
  },
}));

export function resetMenuChromeStoreForTests(): void {
  useMenuChromeStore.getState().resetMenuChromeStoreForTests();
}
