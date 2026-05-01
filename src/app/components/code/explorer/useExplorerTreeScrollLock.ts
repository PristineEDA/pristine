import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { toTreeTestId } from '../../../workspace/workspaceFiles';

interface ExplorerTreeScrollLock {
  anchorTestId: string | null;
  anchorTop: number | null;
  top: number;
  releaseAfterRefreshToken: number;
}

export function useExplorerTreeScrollLock({
  refreshToken,
  syncDependencies,
  treeContainerRef,
}: {
  refreshToken: number;
  syncDependencies: readonly unknown[];
  treeContainerRef: RefObject<HTMLDivElement | null>;
}) {
  const treeScrollLockRef = useRef<ExplorerTreeScrollLock | null>(null);
  const treeScrollLockAnimationFrameRef = useRef<number | null>(null);
  const treeScrollLockReleaseTimeoutRef = useRef<number | null>(null);

  const syncTreeScrollLockPosition = useCallback(() => {
    const treeScrollLock = treeScrollLockRef.current;
    const treeContainer = treeContainerRef.current;

    if (!treeScrollLock || !treeContainer) {
      return false;
    }

    if (treeScrollLock.anchorTestId && treeScrollLock.anchorTop !== null) {
      const anchorElement = treeContainer.querySelector<HTMLElement>(`[data-testid="${treeScrollLock.anchorTestId}"]`);

      if (anchorElement) {
        const currentAnchorTop = Math.round(anchorElement.getBoundingClientRect().top);
        const delta = currentAnchorTop - treeScrollLock.anchorTop;

        if (delta !== 0) {
          treeContainer.scrollTop += delta;
          treeScrollLock.top = Math.round(treeContainer.scrollTop);
        }

        return true;
      }
    }

    if (Math.round(treeContainer.scrollTop) !== treeScrollLock.top) {
      treeContainer.scrollTop = treeScrollLock.top;
    }

    return true;
  }, [treeContainerRef]);

  const stopTreeScrollLockLoop = useCallback(() => {
    if (treeScrollLockAnimationFrameRef.current === null || typeof window === 'undefined') {
      return;
    }

    window.cancelAnimationFrame(treeScrollLockAnimationFrameRef.current);
    treeScrollLockAnimationFrameRef.current = null;
  }, []);

  const clearTreeScrollLockReleaseTimeout = useCallback(() => {
    if (treeScrollLockReleaseTimeoutRef.current === null || typeof window === 'undefined') {
      return;
    }

    window.clearTimeout(treeScrollLockReleaseTimeoutRef.current);
    treeScrollLockReleaseTimeoutRef.current = null;
  }, []);

  const releaseTreeScrollLock = useCallback(() => {
    clearTreeScrollLockReleaseTimeout();
    treeScrollLockRef.current = null;
    stopTreeScrollLockLoop();
  }, [clearTreeScrollLockReleaseTimeout, stopTreeScrollLockLoop]);

  const startTreeScrollLockLoop = useCallback(() => {
    if (treeScrollLockAnimationFrameRef.current !== null || typeof window === 'undefined') {
      return;
    }

    const syncScrollTop = () => {
      if (!syncTreeScrollLockPosition()) {
        treeScrollLockAnimationFrameRef.current = null;
        return;
      }

      treeScrollLockAnimationFrameRef.current = window.requestAnimationFrame(syncScrollTop);
    };

    treeScrollLockAnimationFrameRef.current = window.requestAnimationFrame(syncScrollTop);
  }, [syncTreeScrollLockPosition]);

  const armTreeScrollLockForNextRefresh = useCallback((targetPath: string) => {
    const treeContainer = treeContainerRef.current;

    if (!treeContainer) {
      treeScrollLockRef.current = null;
      stopTreeScrollLockLoop();
      clearTreeScrollLockReleaseTimeout();
      return;
    }

    const top = Math.round(treeContainer.scrollTop);
    const rowElements = Array.from(treeContainer.querySelectorAll<HTMLElement>('[data-testid^="file-tree-node-"]'));
    const targetTestId = `file-tree-node-${toTreeTestId(targetPath)}`;
    const targetIndex = rowElements.findIndex((element) => element.getAttribute('data-testid') === targetTestId);
    const anchorElement = targetIndex >= 0
      ? rowElements[targetIndex + 1] ?? rowElements[targetIndex - 1] ?? rowElements[targetIndex] ?? null
      : null;

    treeScrollLockRef.current = {
      anchorTestId: anchorElement?.getAttribute('data-testid') ?? null,
      anchorTop: anchorElement ? Math.round(anchorElement.getBoundingClientRect().top) : null,
      top,
      releaseAfterRefreshToken: refreshToken + 1,
    };
    treeContainer.scrollTop = top;
    clearTreeScrollLockReleaseTimeout();
    startTreeScrollLockLoop();
  }, [
    clearTreeScrollLockReleaseTimeout,
    refreshToken,
    startTreeScrollLockLoop,
    stopTreeScrollLockLoop,
    treeContainerRef,
  ]);

  useLayoutEffect(() => {
    syncTreeScrollLockPosition();
  }, [syncTreeScrollLockPosition, refreshToken, ...syncDependencies]);

  useEffect(() => {
    const treeScrollLock = treeScrollLockRef.current;

    if (!treeScrollLock || refreshToken < treeScrollLock.releaseAfterRefreshToken || typeof window === 'undefined') {
      return;
    }

    clearTreeScrollLockReleaseTimeout();
    treeScrollLockReleaseTimeoutRef.current = window.setTimeout(() => {
      releaseTreeScrollLock();
    }, 150);

    return () => {
      clearTreeScrollLockReleaseTimeout();
    };
  }, [clearTreeScrollLockReleaseTimeout, refreshToken, releaseTreeScrollLock]);

  useEffect(() => {
    return () => {
      releaseTreeScrollLock();
    };
  }, [releaseTreeScrollLock]);

  return {
    armTreeScrollLockForNextRefresh,
    releaseTreeScrollLock,
  };
}
