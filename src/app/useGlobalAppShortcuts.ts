import { useEffect, useEffectEvent } from 'react';

interface UseGlobalAppShortcutsOptions {
  canToggleLayoutPanels: boolean;
  closeQuickOpen: () => void;
  isQuickOpenVisible: boolean;
  openQuickOpen: () => void;
  saveActiveFile: () => Promise<boolean>;
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
  saveActiveFile,
  setShowBottomPanel,
  setShowLeftPanel,
  showBottomPanel,
  showLeftPanel,
}: UseGlobalAppShortcutsOptions) {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
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

    if (key === 's') {
      event.preventDefault();
      void saveActiveFile();
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
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      handleKeyDown(event);
    };

    document.addEventListener('keydown', listener);
    return () => {
      document.removeEventListener('keydown', listener);
    };
  }, []);
}