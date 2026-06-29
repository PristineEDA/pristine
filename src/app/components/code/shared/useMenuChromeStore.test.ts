import { beforeEach, describe, expect, it } from 'vitest';
import {
  isApplicationMenuExpanded,
  resetMenuChromeStoreForTests,
  useMenuChromeStore,
} from './useMenuChromeStore';

function store() {
  return useMenuChromeStore.getState();
}

describe('useMenuChromeStore', () => {
  beforeEach(() => {
    resetMenuChromeStoreForTests();
  });

  it('starts with collapsed application menu chrome state', () => {
    expect(store().applicationMenuLocked).toBe(false);
    expect(store().applicationMenuHoverExpanded).toBe(false);
    expect(store().applicationMenuOpen).toBe(false);
    expect(isApplicationMenuExpanded(store())).toBe(false);
  });

  it('derives expanded state from lock, hover, or open state', () => {
    store().setApplicationMenuLocked(true);
    expect(isApplicationMenuExpanded(store())).toBe(true);

    store().setApplicationMenuLocked(false);
    expect(isApplicationMenuExpanded(store())).toBe(false);

    store().setApplicationMenuHoverExpanded(true);
    expect(isApplicationMenuExpanded(store())).toBe(true);

    store().setApplicationMenuHoverExpanded(false);
    expect(isApplicationMenuExpanded(store())).toBe(false);

    store().setApplicationMenuOpen(true);
    expect(isApplicationMenuExpanded(store())).toBe(true);
  });

  it('updates individual chrome flags and resets them for tests', () => {
    store().setApplicationMenuLocked(true);
    store().setApplicationMenuHoverExpanded(true);
    store().setApplicationMenuOpen(true);

    expect(store().applicationMenuLocked).toBe(true);
    expect(store().applicationMenuHoverExpanded).toBe(true);
    expect(store().applicationMenuOpen).toBe(true);

    resetMenuChromeStoreForTests();

    expect(store().applicationMenuLocked).toBe(false);
    expect(store().applicationMenuHoverExpanded).toBe(false);
    expect(store().applicationMenuOpen).toBe(false);
  });
});
