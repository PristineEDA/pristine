import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGlobalAppShortcuts } from './useGlobalAppShortcuts';

function ShortcutHarness({
  canToggleLayoutPanels = true,
  isQuickOpenVisible = false,
  onCloseActiveTab = vi.fn(),
  onOpenUntitledFile = vi.fn(),
}: {
  canToggleLayoutPanels?: boolean;
  isQuickOpenVisible?: boolean;
  onCloseActiveTab?: () => void;
  onOpenUntitledFile?: () => void;
}) {
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [showLeftPanel, setShowLeftPanel] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);

  useGlobalAppShortcuts({
    canToggleLayoutPanels,
    closeActiveTabInFocusedGroup: onCloseActiveTab,
    closeQuickOpen: vi.fn(),
    isQuickOpenVisible,
    openUntitledFile: onOpenUntitledFile,
    openQuickOpen: vi.fn(),
    saveActiveFile: vi.fn(async () => true),
    setShowBottomPanel,
    setShowLeftPanel,
    setShowRightPanel,
    showBottomPanel,
    showLeftPanel,
    showRightPanel,
  });

  return (
    <div>
      <span data-testid="left-panel-state">{String(showLeftPanel)}</span>
      <span data-testid="bottom-panel-state">{String(showBottomPanel)}</span>
      <span data-testid="right-panel-state">{String(showRightPanel)}</span>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useGlobalAppShortcuts', () => {
  it('keeps the document keydown listener registered once across state changes', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { rerender, unmount } = render(<ShortcutHarness />);

    const getDocumentKeydownRegistrations = () => addEventListenerSpy.mock.calls.filter(
      ([eventName]) => eventName === 'keydown',
    );

    const getDocumentKeydownRemovals = () => removeEventListenerSpy.mock.calls.filter(
      ([eventName]) => eventName === 'keydown',
    );

    expect(getDocumentKeydownRegistrations()).toHaveLength(1);
    expect(getDocumentKeydownRegistrations()[0]).toEqual(['keydown', expect.any(Function)]);

    rerender(<ShortcutHarness isQuickOpenVisible />);
    rerender(<ShortcutHarness canToggleLayoutPanels={false} isQuickOpenVisible />);

    expect(getDocumentKeydownRegistrations()).toHaveLength(1);
    expect(getDocumentKeydownRemovals()).toHaveLength(0);

    unmount();

    expect(getDocumentKeydownRemovals()).toHaveLength(1);
    expect(getDocumentKeydownRemovals()[0]).toEqual(['keydown', expect.any(Function)]);
  });

  it('uses the latest panel visibility when Ctrl+B, Ctrl+J, and Ctrl+Alt+B toggle panels', () => {
    render(<ShortcutHarness />);

    expect(screen.getByTestId('left-panel-state')).toHaveTextContent('false');
    expect(screen.getByTestId('bottom-panel-state')).toHaveTextContent('false');
    expect(screen.getByTestId('right-panel-state')).toHaveTextContent('false');

    fireEvent.keyDown(document, { key: 'b', ctrlKey: true });
    fireEvent.keyDown(document, { key: 'j', ctrlKey: true });
    fireEvent.keyDown(document, { key: 'b', ctrlKey: true, altKey: true });

    expect(screen.getByTestId('left-panel-state')).toHaveTextContent('true');
    expect(screen.getByTestId('bottom-panel-state')).toHaveTextContent('true');
    expect(screen.getByTestId('right-panel-state')).toHaveTextContent('true');

    fireEvent.keyDown(document, { key: 'b', ctrlKey: true });
    fireEvent.keyDown(document, { key: 'j', ctrlKey: true });
    fireEvent.keyDown(document, { key: 'b', ctrlKey: true, altKey: true });

    expect(screen.getByTestId('left-panel-state')).toHaveTextContent('false');
    expect(screen.getByTestId('bottom-panel-state')).toHaveTextContent('false');
    expect(screen.getByTestId('right-panel-state')).toHaveTextContent('false');
  });

  it('routes Ctrl+N and Ctrl+W to untitled creation and active-tab closing', () => {
    const onOpenUntitledFile = vi.fn();
    const onCloseActiveTab = vi.fn();

    render(
      <ShortcutHarness
        onCloseActiveTab={onCloseActiveTab}
        onOpenUntitledFile={onOpenUntitledFile}
      />,
    );

    fireEvent.keyDown(document, { key: 'n', ctrlKey: true });
    fireEvent.keyDown(document, { key: 'w', ctrlKey: true });

    expect(onOpenUntitledFile).toHaveBeenCalledTimes(1);
    expect(onCloseActiveTab).toHaveBeenCalledTimes(1);
  });
});