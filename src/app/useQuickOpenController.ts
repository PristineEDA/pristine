import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { EditorSelectionSnapshot } from './context/useWorkspaceEditorState';
import {
  createQuickOpenFileEntries,
  getRecentQuickOpenFiles,
  searchQuickOpenFiles,
  type QuickOpenFileEntry,
  type QuickOpenSearchResult,
} from './quickOpen/quickOpenSearch';
import { useQuickOpenStore } from './useQuickOpenStore';
import { isWorkspaceRelativeFilePath } from './workspace/workspaceFiles';

const EMPTY_QUICK_OPEN_FILES: QuickOpenFileEntry[] = [];

interface UseQuickOpenControllerOptions {
  activeTabId: string;
  captureEditorSelectionSnapshot: () => EditorSelectionSnapshot | null;
  openFile: (filePath: string, fileName: string) => void;
  openPreviewFile: (filePath: string, fileName: string) => void;
  restoreActiveEditorFocus: () => void;
  restoreEditorSelection: (snapshot: EditorSelectionSnapshot) => void;
  workspaceTreeRefreshToken: number;
}

export function useQuickOpenController({
  activeTabId,
  captureEditorSelectionSnapshot,
  openFile,
  openPreviewFile,
  restoreActiveEditorFocus,
  restoreEditorSelection,
  workspaceTreeRefreshToken,
}: UseQuickOpenControllerOptions) {
  const errorMessage = useQuickOpenStore((state) => state.errorMessage);
  const isLoading = useQuickOpenStore((state) => state.isLoading);
  const isVisible = useQuickOpenStore((state) => state.isVisible);
  const query = useQuickOpenStore((state) => state.query);
  const recentFiles = useQuickOpenStore((state) => state.recentFiles);
  const revealRequest = useQuickOpenStore((state) => state.revealRequest);
  const selectedIndex = useQuickOpenStore((state) => state.selectedIndex);
  const workspaceFiles = useQuickOpenStore((state) => state.workspaceFiles);
  const clampSelectedIndex = useQuickOpenStore((state) => state.clampSelectedIndex);
  const closeQuickOpenState = useQuickOpenStore((state) => state.closeQuickOpenState);
  const failIndexing = useQuickOpenStore((state) => state.failIndexing);
  const finishIndexing = useQuickOpenStore((state) => state.finishIndexing);
  const invalidateWorkspaceFilesState = useQuickOpenStore((state) => state.invalidateWorkspaceFiles);
  const openQuickOpenState = useQuickOpenStore((state) => state.openQuickOpenState);
  const recordRecentFileState = useQuickOpenStore((state) => state.recordRecentFile);
  const setQuery = useQuickOpenStore((state) => state.setQuery);
  const setRevealRequest = useQuickOpenStore((state) => state.setRevealRequest);
  const setSelectedIndex = useQuickOpenStore((state) => state.setSelectedIndex);
  const startIndexing = useQuickOpenStore((state) => state.startIndexing);
  const revealTokenRef = useRef(0);
  const lastHandledActiveFileRevealRef = useRef('');
  const quickOpenEditorSnapshotRef = useRef<EditorSelectionSnapshot | null>(null);

  const quickOpenState = useMemo(() => ({
    errorMessage,
    isLoading,
    isVisible,
    query,
    recentFiles,
    revealRequest,
    selectedIndex,
    workspaceFiles,
  }), [errorMessage, isLoading, isVisible, query, recentFiles, revealRequest, selectedIndex, workspaceFiles]);

  const closeQuickOpen = useCallback((options?: { restorePreviousEditor?: boolean }) => {
    const shouldRestorePreviousEditor = options?.restorePreviousEditor ?? true;
    const snapshot = quickOpenEditorSnapshotRef.current;

    quickOpenEditorSnapshotRef.current = null;
    closeQuickOpenState();
    if (shouldRestorePreviousEditor && snapshot) {
      restoreEditorSelection(snapshot);
    }

    restoreActiveEditorFocus();
  }, [closeQuickOpenState, restoreActiveEditorFocus, restoreEditorSelection]);

  const openQuickOpen = useCallback(() => {
    quickOpenEditorSnapshotRef.current = captureEditorSelectionSnapshot();
    openQuickOpenState();
  }, [captureEditorSelectionSnapshot, openQuickOpenState]);

  const invalidateWorkspaceFiles = useCallback(() => {
    invalidateWorkspaceFilesState();
  }, [invalidateWorkspaceFilesState]);

  const recordRecentFile = useCallback((filePath: string, fileName: string) => {
    recordRecentFileState(filePath, fileName);
  }, [recordRecentFileState]);

  const queueRevealRequest = useCallback((filePath: string, options?: { markActiveFileHandled?: boolean }) => {
    if (!filePath || !isWorkspaceRelativeFilePath(filePath)) {
      return;
    }

    if (options?.markActiveFileHandled) {
      lastHandledActiveFileRevealRef.current = filePath;
    }

    revealTokenRef.current += 1;
    setRevealRequest({ path: filePath, token: revealTokenRef.current });
  }, [setRevealRequest]);

  const handleQuickOpenQueryChange = useCallback((query: string) => {
    setQuery(query);
  }, [setQuery]);

  const handleQuickOpenSelectedIndexChange = useCallback((index: number) => {
    setSelectedIndex(index);
  }, [setSelectedIndex]);

  const openWorkspaceFile = useCallback((filePath: string, fileName: string) => {
    queueRevealRequest(filePath, { markActiveFileHandled: true });
    recordRecentFile(filePath, fileName);
    openFile(filePath, fileName);
  }, [openFile, queueRevealRequest, recordRecentFile]);

  const openWorkspacePreviewFile = useCallback((filePath: string, fileName: string) => {
    queueRevealRequest(filePath, { markActiveFileHandled: true });
    recordRecentFile(filePath, fileName);
    openPreviewFile(filePath, fileName);
  }, [openPreviewFile, queueRevealRequest, recordRecentFile]);

  const handleEditorActiveFileReveal = useCallback((filePath: string) => {
    queueRevealRequest(filePath, { markActiveFileHandled: true });
  }, [queueRevealRequest]);

  useEffect(() => {
    if (!activeTabId || activeTabId === lastHandledActiveFileRevealRef.current) {
      return;
    }

    lastHandledActiveFileRevealRef.current = activeTabId;
    if (isWorkspaceRelativeFilePath(activeTabId)) {
      queueRevealRequest(activeTabId);
    }
  }, [activeTabId, queueRevealRequest]);

  useEffect(() => {
    if (workspaceTreeRefreshToken === 0) {
      return;
    }

    invalidateWorkspaceFiles();
  }, [invalidateWorkspaceFiles, workspaceTreeRefreshToken]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    if (!isVisible || workspaceFiles !== null) {
      return;
    }

    const fsApi = window.electronAPI?.fs;
    if (!fsApi) {
      failIndexing('Filesystem API unavailable');
      return;
    }

    let cancelled = false;
    startIndexing();

    void fsApi.listFiles('.')
      .then((paths) => {
        if (cancelled) {
          return;
        }

        finishIndexing(createQuickOpenFileEntries(paths));
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        failIndexing(error instanceof Error ? error.message : 'Unable to index workspace files');
      });

    return () => {
      cancelled = true;
    };
  }, [failIndexing, finishIndexing, isVisible, startIndexing, workspaceFiles]);

  const isQuickOpenRecentMode = query.trim().length === 0;
  const quickOpenResults = useMemo(() => {
    if (isQuickOpenRecentMode) {
      return getRecentQuickOpenFiles(recentFiles, workspaceFiles);
    }

    return searchQuickOpenFiles(workspaceFiles ?? EMPTY_QUICK_OPEN_FILES, query);
  }, [isQuickOpenRecentMode, query, recentFiles, workspaceFiles]);

  useEffect(() => {
    clampSelectedIndex(quickOpenResults.length);
  }, [clampSelectedIndex, quickOpenResults.length]);

  const handleQuickOpenSelect = useCallback((result: QuickOpenSearchResult) => {
    openWorkspaceFile(result.path, result.name);
    closeQuickOpen({ restorePreviousEditor: false });
  }, [closeQuickOpen, openWorkspaceFile]);

  return {
    closeQuickOpen,
    handleEditorActiveFileReveal,
    handleQuickOpenQueryChange,
    handleQuickOpenSelect,
    handleQuickOpenSelectedIndexChange,
    invalidateWorkspaceFiles,
    isQuickOpenRecentMode,
    openQuickOpen,
    openWorkspaceFile,
    openWorkspacePreviewFile,
    queueRevealRequest,
    quickOpenResults,
    quickOpenState,
  };
}
