import { describe, expect, it, beforeEach } from 'vitest';
import {
  resetSettingsDialogSessionForTests,
  useSettingsDialogSessionStore,
} from './useSettingsDialogSessionStore';

function getStoreState() {
  return useSettingsDialogSessionStore.getState();
}

describe('useSettingsDialogSessionStore', () => {
  beforeEach(() => {
    resetSettingsDialogSessionForTests();
  });

  it('starts on the general page with an empty search query', () => {
    expect(getStoreState().activePageId).toBe('general');
    expect(getStoreState().settingsSearchQuery).toBe('');
  });

  it('updates the active page', () => {
    getStoreState().setActivePageId('schematic');

    expect(getStoreState().activePageId).toBe('schematic');
  });

  it('updates and clears the search query', () => {
    getStoreState().setSettingsSearchQuery('font');
    expect(getStoreState().settingsSearchQuery).toBe('font');

    getStoreState().clearSettingsSearchQuery();
    expect(getStoreState().settingsSearchQuery).toBe('');
  });

  it('resets session state for tests', () => {
    getStoreState().setActivePageId('window');
    getStoreState().setSettingsSearchQuery('tray');

    resetSettingsDialogSessionForTests();

    expect(getStoreState().activePageId).toBe('general');
    expect(getStoreState().settingsSearchQuery).toBe('');
  });
});
