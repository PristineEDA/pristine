import { beforeEach, describe, expect, it } from 'vitest';
import {
  MIN_SPLIT_PANE_WIDTH_PX,
  SPLIT_HANDLE_GAP_PX,
  normalizeBottomPaneSizes,
  resetBottomPanelStoreForTests,
  useBottomPanelStore,
} from './useBottomPanelStore';

const splitWidth = MIN_SPLIT_PANE_WIDTH_PX * 2 + SPLIT_HANDLE_GAP_PX;

function getStore() {
  return useBottomPanelStore.getState();
}

describe('useBottomPanelStore', () => {
  beforeEach(() => {
    resetBottomPanelStoreForTests();
  });

  it('starts with a single focused terminal pane', () => {
    expect(getStore().focusedPaneId).toBe('bottom-pane-1');
    expect(getStore().panes).toEqual([
      {
        content: { kind: 'tab', tab: 'terminal' },
        id: 'bottom-pane-1',
        size: 100,
      },
    ]);
  });

  it('updates focused pane content and measured width', () => {
    getStore().updatePaneContent('bottom-pane-1', { kind: 'placeholder', icon: 'file', label: 'Placeholder A' }, 420);

    expect(getStore().focusedPaneId).toBe('bottom-pane-1');
    expect(getStore().focusedPaneMeasuredWidth).toBe(420);
    expect(getStore().panes[0]?.content).toEqual({ kind: 'placeholder', icon: 'file', label: 'Placeholder A' });

    getStore().setFocusedPaneTab('lsp', 512);

    expect(getStore().focusedPaneMeasuredWidth).toBe(512);
    expect(getStore().panes[0]?.content).toEqual({ kind: 'tab', tab: 'lsp' });
  });

  it('splits the focused pane when the measured width is large enough', () => {
    expect(getStore().splitFocusedPane(splitWidth - 1)).toBe(false);
    expect(getStore().panes).toHaveLength(1);

    expect(getStore().splitFocusedPane(splitWidth)).toBe(true);

    expect(getStore().focusedPaneId).toBe('bottom-pane-2');
    expect(getStore().nextPaneIndex).toBe(3);
    expect(getStore().panes).toEqual([
      { content: { kind: 'tab', tab: 'terminal' }, id: 'bottom-pane-1', size: 50 },
      { content: { kind: 'empty' }, id: 'bottom-pane-2', size: 50 },
    ]);
  });

  it('removes the focused pane and returns the removed pane for cleanup', () => {
    getStore().splitFocusedPane(splitWidth);
    getStore().updatePaneContent('bottom-pane-2', { kind: 'tab', tab: 'terminal' });

    const removed = getStore().removeFocusedPane();

    expect(removed?.pane).toMatchObject({
      content: { kind: 'tab', tab: 'terminal' },
      id: 'bottom-pane-2',
    });
    expect(removed?.nextFocusedPaneId).toBe('bottom-pane-1');
    expect(getStore().focusedPaneId).toBe('bottom-pane-1');
    expect(getStore().panes).toHaveLength(1);
    expect(getStore().panes[0]?.size).toBe(100);

    expect(getStore().removeFocusedPane()).toBeNull();
  });

  it('updates pane sizes and normalizes panes defensively', () => {
    getStore().splitFocusedPane(splitWidth);
    getStore().setPaneSize('bottom-pane-1', 35);

    expect(getStore().panes.find((pane) => pane.id === 'bottom-pane-1')?.size).toBe(35);
    expect(normalizeBottomPaneSizes([
      { content: { kind: 'empty' }, id: 'a', size: 0 },
      { content: { kind: 'empty' }, id: 'b', size: 0 },
    ])).toEqual([
      { content: { kind: 'empty' }, id: 'a', size: 50 },
      { content: { kind: 'empty' }, id: 'b', size: 50 },
    ]);
  });

  it('captures and hydrates project bottom pane layout', () => {
    getStore().splitFocusedPane(splitWidth);
    getStore().updatePaneContent('bottom-pane-2', { kind: 'placeholder', icon: 'boxes', label: 'Placeholder B' });
    getStore().setPaneSize('bottom-pane-1', 30);
    getStore().setPaneSize('bottom-pane-2', 70);

    const snapshot = getStore().captureProjectBottomPanelSession();
    resetBottomPanelStoreForTests();
    getStore().hydrateProjectBottomPanelSession(snapshot);

    expect(getStore().focusedPaneId).toBe('bottom-pane-2');
    expect(getStore().nextPaneIndex).toBe(3);
    expect(getStore().panes).toEqual([
      { content: { kind: 'tab', tab: 'terminal' }, id: 'bottom-pane-1', size: 30 },
      { content: { kind: 'placeholder', icon: 'boxes', label: 'Placeholder B' }, id: 'bottom-pane-2', size: 70 },
    ]);
    expect(getStore().focusedPaneMeasuredWidth).toBe(Number.POSITIVE_INFINITY);
  });

  it('temporarily overrides a pane with WSL terminal content and restores the previous terminal content', () => {
    expect(getStore().showWslTerminalInPane('bottom-pane-1', 640)).toBe(true);

    expect(getStore().focusedPaneId).toBe('bottom-pane-1');
    expect(getStore().focusedPaneMeasuredWidth).toBe(640);
    expect(getStore().wslPaneOverride).toEqual({
      paneId: 'bottom-pane-1',
      previousContent: { kind: 'tab', tab: 'terminal' },
    });
    expect(getStore().panes[0]?.content).toEqual({
      kind: 'tab',
      tab: 'terminal',
      terminalProfile: 'wsl-pristine-eda',
    });
    expect(getStore().captureProjectBottomPanelSession().panes[0]?.content).toEqual({ kind: 'tab', tab: 'terminal' });

    expect(getStore().restoreWslPaneOverride()).toBe(true);

    expect(getStore().wslPaneOverride).toBeNull();
    expect(getStore().panes[0]?.content).toEqual({ kind: 'tab', tab: 'terminal' });
  });

  it('does not force restore when the WSL pane was changed by the user', () => {
    expect(getStore().showWslTerminalInPane('bottom-pane-1')).toBe(true);

    getStore().updatePaneContent('bottom-pane-1', { kind: 'placeholder', icon: 'file', label: 'Placeholder A' });

    expect(getStore().wslPaneOverride).toBeNull();
    expect(getStore().restoreWslPaneOverride()).toBe(false);
    expect(getStore().panes[0]?.content).toEqual({ kind: 'placeholder', icon: 'file', label: 'Placeholder A' });
  });

  it('clears WSL override when the overridden pane is removed', () => {
    getStore().splitFocusedPane(splitWidth);
    expect(getStore().showWslTerminalInPane('bottom-pane-2')).toBe(true);

    const removed = getStore().removeFocusedPane();

    expect(removed?.pane.id).toBe('bottom-pane-2');
    expect(getStore().wslPaneOverride).toBeNull();
    expect(getStore().restoreWslPaneOverride()).toBe(false);
    expect(getStore().panes).toEqual([
      { content: { kind: 'tab', tab: 'terminal' }, id: 'bottom-pane-1', size: 100 },
    ]);
  });

  it('normalizes invalid hydrated bottom pane payloads', () => {
    getStore().hydrateProjectBottomPanelSession({
      focusedPaneId: 'missing-pane',
      nextPaneIndex: 1,
      panes: [
        { content: { kind: 'tab', tab: 'not-a-tab' } as any, id: 'pane-a', size: 0 },
        { content: { kind: 'placeholder', icon: 'unknown', label: '' } as any, id: 'pane-b', size: 25 },
        { content: { kind: 'tab', tab: 'lsp' }, id: 'pane-b', size: 25 },
      ],
    });

    expect(getStore().focusedPaneId).toBe('pane-a');
    expect(getStore().nextPaneIndex).toBe(3);
    expect(getStore().panes).toEqual([
      { content: { kind: 'empty' }, id: 'pane-a', size: 80 },
      { content: { kind: 'placeholder', icon: 'file', label: 'Placeholder' }, id: 'pane-b', size: 20 },
    ]);

    getStore().hydrateProjectBottomPanelSession(null);

    expect(getStore().focusedPaneId).toBe('bottom-pane-1');
    expect(getStore().panes).toEqual([
      { content: { kind: 'tab', tab: 'terminal' }, id: 'bottom-pane-1', size: 100 },
    ]);
  });
});
