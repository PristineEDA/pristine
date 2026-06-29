import { beforeEach, describe, expect, it } from 'vitest';
import {
  QUICK_OPEN_RECENT_LIMIT,
  resetQuickOpenStoreForTests,
  useQuickOpenStore,
} from './useQuickOpenStore';

function store() {
  return useQuickOpenStore.getState();
}

describe('useQuickOpenStore', () => {
  beforeEach(() => {
    resetQuickOpenStoreForTests();
  });

  it('starts with hidden empty quick open state', () => {
    expect(store().isVisible).toBe(false);
    expect(store().query).toBe('');
    expect(store().selectedIndex).toBe(0);
    expect(store().workspaceFiles).toBeNull();
    expect(store().isLoading).toBe(false);
    expect(store().errorMessage).toBeNull();
    expect(store().recentFiles).toEqual([]);
    expect(store().revealRequest).toBeNull();
  });

  it('opens and closes while resetting query and selected index', () => {
    store().setQuery('alu');
    store().setSelectedIndex(4);

    store().openQuickOpenState();

    expect(store().isVisible).toBe(true);
    expect(store().query).toBe('');
    expect(store().selectedIndex).toBe(0);

    store().setQuery('cpu');
    store().setSelectedIndex(2);
    store().closeQuickOpenState();

    expect(store().isVisible).toBe(false);
    expect(store().query).toBe('');
    expect(store().selectedIndex).toBe(0);
  });

  it('sets query and selected index', () => {
    store().setQuery('reg');
    store().setSelectedIndex(3);

    expect(store().query).toBe('reg');
    expect(store().selectedIndex).toBe(3);
  });

  it('clamps selected index to available results', () => {
    store().setSelectedIndex(8);
    store().clampSelectedIndex(3);

    expect(store().selectedIndex).toBe(2);

    store().clampSelectedIndex(0);

    expect(store().selectedIndex).toBe(0);
  });

  it('tracks indexing progress and errors', () => {
    store().startIndexing();

    expect(store().isLoading).toBe(true);
    expect(store().errorMessage).toBeNull();

    store().failIndexing('No project open');

    expect(store().isLoading).toBe(false);
    expect(store().errorMessage).toBe('No project open');

    const files = [{ name: 'alu.sv', path: 'rtl/alu.sv' }];
    store().finishIndexing(files);

    expect(store().isLoading).toBe(false);
    expect(store().workspaceFiles).toEqual(files);
  });

  it('invalidates workspace files without clearing recent files', () => {
    store().recordRecentFile('rtl/alu.sv', 'alu.sv');
    store().finishIndexing([{ name: 'alu.sv', path: 'rtl/alu.sv' }]);
    store().failIndexing('stale');

    store().invalidateWorkspaceFiles();

    expect(store().workspaceFiles).toBeNull();
    expect(store().errorMessage).toBeNull();
    expect(store().recentFiles).toEqual([{ name: 'alu.sv', path: 'rtl/alu.sv' }]);
  });

  it('records recent files with dedupe and limit', () => {
    for (let index = 0; index < QUICK_OPEN_RECENT_LIMIT + 2; index += 1) {
      store().recordRecentFile(`rtl/file_${index}.sv`, `file_${index}.sv`);
    }

    expect(store().recentFiles).toHaveLength(QUICK_OPEN_RECENT_LIMIT);
    expect(store().recentFiles[0]).toEqual({ name: 'file_21.sv', path: 'rtl/file_21.sv' });
    expect(store().recentFiles[store().recentFiles.length - 1]).toEqual({ name: 'file_2.sv', path: 'rtl/file_2.sv' });

    store().recordRecentFile('rtl/file_7.sv', 'file_7.sv');

    expect(store().recentFiles).toHaveLength(QUICK_OPEN_RECENT_LIMIT);
    expect(store().recentFiles[0]).toEqual({ name: 'file_7.sv', path: 'rtl/file_7.sv' });
    expect(store().recentFiles.filter((item) => item.path === 'rtl/file_7.sv')).toHaveLength(1);
  });

  it('stores reveal requests and resets test state', () => {
    store().openQuickOpenState();
    store().recordRecentFile('rtl/alu.sv', 'alu.sv');
    store().setRevealRequest({ path: 'rtl/alu.sv', token: 3 });

    expect(store().revealRequest).toEqual({ path: 'rtl/alu.sv', token: 3 });

    resetQuickOpenStoreForTests();

    expect(store().isVisible).toBe(false);
    expect(store().recentFiles).toEqual([]);
    expect(store().revealRequest).toBeNull();
  });
});
