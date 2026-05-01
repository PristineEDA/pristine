import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { EditorSelectionSnapshot } from './context/useWorkspaceEditorState';
import {
  createQuickOpenFileEntries,
  getRecentQuickOpenFiles,
  searchQuickOpenFiles,
  type QuickOpenFileEntry,
  type QuickOpenSearchResult,
} from './quickOpen/quickOpenSearch';
import type { WorkspaceRevealRequest } from './workspace/useWorkspaceTree';
import { isWorkspaceRelativeFilePath } from './workspace/workspaceFiles';

const QUICK_OPEN_RECENT_LIMIT = 20;
const EMPTY_QUICK_OPEN_FILES: QuickOpenFileEntry[] = [];

interface QuickOpenState {
  isVisible: boolean;
  query: string;
  selectedIndex: number;
  workspaceFiles: QuickOpenFileEntry[] | null;
  isLoading: boolean;
  errorMessage: string | null;
  recentFiles: QuickOpenFileEntry[];
  revealRequest: WorkspaceRevealRequest | null;
}

type QuickOpenAction =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'setQuery'; query: string }
  | { type: 'setSelectedIndex'; index: number }
  | { type: 'clampSelectedIndex'; resultCount: number }
  | { type: 'startIndexing' }
  | { type: 'finishIndexing'; files: QuickOpenFileEntry[] }
  | { type: 'failIndexing'; errorMessage: string }
  | { type: 'invalidateWorkspaceFiles' }
  | { type: 'recordRecentFile'; filePath: string; fileName: string }
  | { type: 'setRevealRequest'; revealRequest: WorkspaceRevealRequest };

const QUICK_OPEN_INITIAL_STATE: QuickOpenState = {
  isVisible: false,
  query: '',
  selectedIndex: 0,
  workspaceFiles: null,
  isLoading: false,
  errorMessage: null,
  recentFiles: [],
  revealRequest: null,
};

function quickOpenReducer(state: QuickOpenState, action: QuickOpenAction): QuickOpenState {
  switch (action.type) {
    case 'open':
      return {
        ...state,
        isVisible: true,
        query: '',
        selectedIndex: 0,
      };
    case 'close':
      return {
        ...state,
        isVisible: false,
        query: '',
        selectedIndex: 0,
      };
    case 'setQuery':
      if (state.query === action.query) {
        return state;
      }

      return {
        ...state,
        query: action.query,
      };
    case 'setSelectedIndex':
      if (state.selectedIndex === action.index) {
        return state;
      }

      return {
        ...state,
        selectedIndex: action.index,
      };
    case 'clampSelectedIndex': {
      const nextSelectedIndex = action.resultCount === 0
        ? 0
        : Math.min(state.selectedIndex, action.resultCount - 1);

      if (state.selectedIndex === nextSelectedIndex) {
        return state;
      }

      return {
        ...state,
        selectedIndex: nextSelectedIndex,
      };
    }
    case 'startIndexing':
      return {
        ...state,
        isLoading: true,
        errorMessage: null,
      };
    case 'finishIndexing':
      return {
        ...state,
        workspaceFiles: action.files,
        isLoading: false,
      };
    case 'failIndexing':
      return {
        ...state,
        isLoading: false,
        errorMessage: action.errorMessage,
      };
    case 'invalidateWorkspaceFiles':
      return {
        ...state,
        workspaceFiles: null,
        errorMessage: null,
      };
    case 'recordRecentFile': {
      const entry = { path: action.filePath, name: action.fileName };

      return {
        ...state,
        recentFiles: [entry, ...state.recentFiles.filter((item) => item.path !== action.filePath)].slice(0, QUICK_OPEN_RECENT_LIMIT),
      };
    }
    case 'setRevealRequest':
      return {
        ...state,
        revealRequest: action.revealRequest,
      };
    default:
      return state;
  }
}

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
  const [quickOpenState, dispatchQuickOpen] = useReducer(quickOpenReducer, QUICK_OPEN_INITIAL_STATE);
  const revealTokenRef = useRef(0);
  const lastHandledActiveFileRevealRef = useRef('');
  const quickOpenEditorSnapshotRef = useRef<EditorSelectionSnapshot | null>(null);

  const closeQuickOpen = useCallback((options?: { restorePreviousEditor?: boolean }) => {
    const shouldRestorePreviousEditor = options?.restorePreviousEditor ?? true;
    const snapshot = quickOpenEditorSnapshotRef.current;

    quickOpenEditorSnapshotRef.current = null;
    dispatchQuickOpen({ type: 'close' });
    if (shouldRestorePreviousEditor && snapshot) {
      restoreEditorSelection(snapshot);
    }

    restoreActiveEditorFocus();
  }, [restoreActiveEditorFocus, restoreEditorSelection]);

  const openQuickOpen = useCallback(() => {
    quickOpenEditorSnapshotRef.current = captureEditorSelectionSnapshot();
    dispatchQuickOpen({ type: 'open' });
  }, [captureEditorSelectionSnapshot]);

  const invalidateWorkspaceFiles = useCallback(() => {
    dispatchQuickOpen({ type: 'invalidateWorkspaceFiles' });
  }, []);

  const recordRecentFile = useCallback((filePath: string, fileName: string) => {
    dispatchQuickOpen({ type: 'recordRecentFile', filePath, fileName });
  }, []);

  const queueRevealRequest = useCallback((filePath: string, options?: { markActiveFileHandled?: boolean }) => {
    if (!filePath || !isWorkspaceRelativeFilePath(filePath)) {
      return;
    }

    if (options?.markActiveFileHandled) {
      lastHandledActiveFileRevealRef.current = filePath;
    }

    revealTokenRef.current += 1;
    dispatchQuickOpen({
      type: 'setRevealRequest',
      revealRequest: { path: filePath, token: revealTokenRef.current },
    });
  }, []);

  const handleQuickOpenQueryChange = useCallback((query: string) => {
    dispatchQuickOpen({ type: 'setQuery', query });
  }, []);

  const handleQuickOpenSelectedIndexChange = useCallback((index: number) => {
    dispatchQuickOpen({ type: 'setSelectedIndex', index });
  }, []);

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

    if (!quickOpenState.isVisible || quickOpenState.workspaceFiles !== null) {
      return;
    }

    const fsApi = window.electronAPI?.fs;
    if (!fsApi) {
      dispatchQuickOpen({ type: 'failIndexing', errorMessage: 'Filesystem API unavailable' });
      return;
    }

    let cancelled = false;
    dispatchQuickOpen({ type: 'startIndexing' });

    void fsApi.listFiles('.')
      .then((paths) => {
        if (cancelled) {
          return;
        }

        dispatchQuickOpen({ type: 'finishIndexing', files: createQuickOpenFileEntries(paths) });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        dispatchQuickOpen({
          type: 'failIndexing',
          errorMessage: error instanceof Error ? error.message : 'Unable to index workspace files',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [quickOpenState.isVisible, quickOpenState.workspaceFiles]);

  const isQuickOpenRecentMode = quickOpenState.query.trim().length === 0;
  const quickOpenResults = useMemo(() => {
    if (isQuickOpenRecentMode) {
      return getRecentQuickOpenFiles(quickOpenState.recentFiles, quickOpenState.workspaceFiles);
    }

    return searchQuickOpenFiles(quickOpenState.workspaceFiles ?? EMPTY_QUICK_OPEN_FILES, quickOpenState.query);
  }, [isQuickOpenRecentMode, quickOpenState.query, quickOpenState.recentFiles, quickOpenState.workspaceFiles]);

  useEffect(() => {
    dispatchQuickOpen({ type: 'clampSelectedIndex', resultCount: quickOpenResults.length });
  }, [quickOpenResults.length]);

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
