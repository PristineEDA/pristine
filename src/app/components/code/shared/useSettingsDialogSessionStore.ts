import { create } from 'zustand';

export type SettingsPageId = 'general' | 'appearance' | 'editor' | 'design' | 'schematic' | 'eda' | 'pdk' | 'agent' | 'window';

interface SettingsDialogSessionState {
  activePageId: SettingsPageId;
  settingsSearchQuery: string;
}

interface SettingsDialogSessionActions {
  clearSettingsSearchQuery: () => void;
  resetSettingsDialogSessionForTests: () => void;
  setActivePageId: (pageId: SettingsPageId) => void;
  setSettingsSearchQuery: (query: string) => void;
}

export type SettingsDialogSessionStore = SettingsDialogSessionState & SettingsDialogSessionActions;

function createDefaultSettingsDialogSessionState(): SettingsDialogSessionState {
  return {
    activePageId: 'general',
    settingsSearchQuery: '',
  };
}

export const useSettingsDialogSessionStore = create<SettingsDialogSessionStore>((set) => ({
  ...createDefaultSettingsDialogSessionState(),

  clearSettingsSearchQuery: () => {
    set((state) => (state.settingsSearchQuery === '' ? state : { settingsSearchQuery: '' }));
  },

  resetSettingsDialogSessionForTests: () => {
    set(createDefaultSettingsDialogSessionState());
  },

  setActivePageId: (pageId) => {
    set((state) => (state.activePageId === pageId ? state : { activePageId: pageId }));
  },

  setSettingsSearchQuery: (query) => {
    set((state) => (state.settingsSearchQuery === query ? state : { settingsSearchQuery: query }));
  },
}));

export function resetSettingsDialogSessionForTests(): void {
  useSettingsDialogSessionStore.getState().resetSettingsDialogSessionForTests();
}
