import { useEffect, useEffectEvent } from 'react';

interface UseGlobalAppShortcutsOptions {
  canToggleLayoutPanels: boolean;
  closeActiveTabInFocusedGroup: () => void;
  closeQuickOpen: () => void;
  isQuickOpenVisible: boolean;
  openUntitledFile: () => void;
  openQuickOpen: () => void;
  saveActiveFile: () => Promise<boolean>;
  setShowBottomPanel: (show: boolean) => void;
  setShowLeftPanel: (show: boolean) => void;
  setShowRightPanel: (show: boolean) => void;
  showBottomPanel: boolean;
  showLeftPanel: boolean;
  showRightPanel: boolean;
}

function isPrimaryModifierShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey;
}

function isPrimaryAltModifierShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.shiftKey && event.altKey;
}

export function useGlobalAppShortcuts({
  canToggleLayoutPanels,
  closeActiveTabInFocusedGroup,
  closeQuickOpen,
  isQuickOpenVisible,
  openUntitledFile,
  openQuickOpen,
  saveActiveFile,
  setShowBottomPanel,
  setShowLeftPanel,
  setShowRightPanel,
  showBottomPanel,
  showLeftPanel,
  showRightPanel,
}: UseGlobalAppShortcutsOptions) {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();

    if (key === 'b' && isPrimaryAltModifierShortcut(event)) {
      if (!canToggleLayoutPanels) {
        return;
      }

      event.preventDefault();
      setShowRightPanel(!showRightPanel);
      return;
    }

    if (!isPrimaryModifierShortcut(event)) {
      return;
    }

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

    if (key === 'n') {
      event.preventDefault();
      openUntitledFile();
      return;
    }

    if (key === 'w') {
      event.preventDefault();
      closeActiveTabInFocusedGroup();
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