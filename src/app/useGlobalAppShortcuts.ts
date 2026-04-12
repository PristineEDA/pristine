import { useEffect } from 'react';

interface UseGlobalAppShortcutsOptions {
  canToggleLayoutPanels: boolean;
  closeQuickOpen: () => void;
  isQuickOpenVisible: boolean;
  openQuickOpen: () => void;
  setShowBottomPanel: (show: boolean) => void;
  setShowLeftPanel: (show: boolean) => void;
  showBottomPanel: boolean;
  showLeftPanel: boolean;
}

function isPrimaryModifierShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey;
}

export function useGlobalAppShortcuts({
  canToggleLayoutPanels,
  closeQuickOpen,
  isQuickOpenVisible,
  openQuickOpen,
  setShowBottomPanel,
  setShowLeftPanel,
  showBottomPanel,
  showLeftPanel,
}: UseGlobalAppShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isPrimaryModifierShortcut(event)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === 'p') {
        event.preventDefault();

        if (isQuickOpenVisible) {
          closeQuickOpen();
          return;
        }

        openQuickOpen();
        return;
      }

      if (key === 'j') {
        if (!canToggleLayoutPanels) {
          return;
        }

        event.preventDefault();
        setShowBottomPanel(!showBottomPanel);
        return;
      }

      if (key === 'b') {
        if (!canToggleLayoutPanels) {
          return;
        }

        event.preventDefault();
        setShowLeftPanel(!showLeftPanel);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    canToggleLayoutPanels,
    closeQuickOpen,
    isQuickOpenVisible,
    openQuickOpen,
    setShowBottomPanel,
    setShowLeftPanel,
    showBottomPanel,
    showLeftPanel,
  ]);
}