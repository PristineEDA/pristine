import { useEffect, useRef, useState } from 'react';

interface EditorDocumentTab {
  id: string;
  name: string;
}

interface UseEditorDocumentStateOptions {
  tabs: EditorDocumentTab[];
  activeTabId: string;
  contentCache?: Record<string, string>;
  loadingFiles?: Record<string, boolean>;
  loadErrors?: Record<string, string>;
  onLoadFile?: (fileId: string) => void;
  onContentChange?: (fileId: string, content: string) => void;
}

export function useEditorDocumentState({
  tabs,
  activeTabId,
  contentCache,
  loadingFiles,
  loadErrors,
  onLoadFile,
  onContentChange,
}: UseEditorDocumentStateOptions) {
  const [localContentCache, setLocalContentCache] = useState<Record<string, string>>({});
  const [localLoadingFiles, setLocalLoadingFiles] = useState<Record<string, boolean>>({});
  const [localLoadErrors, setLocalLoadErrors] = useState<Record<string, string>>({});
  const inFlightLoadsRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);

  const resolvedContentCache = contentCache ?? localContentCache;
  const resolvedLoadingFiles = loadingFiles ?? localLoadingFiles;
  const resolvedLoadErrors = loadErrors ?? localLoadErrors;
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const code = activeTabId
    ? resolvedLoadErrors[activeTabId]
      ? `// Failed to load ${activeTab?.name ?? activeTabId}\n// ${resolvedLoadErrors[activeTabId]}\n`
      : resolvedLoadingFiles[activeTabId]
      ? `// ${activeTab?.name ?? activeTabId}\n// Loading file contents...\n`
      : resolvedContentCache[activeTabId] ?? `// ${activeTab?.name ?? activeTabId}\n// Loading file contents...\n`
    : '';

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useEffect(() => {
    if (!activeTabId || resolvedContentCache[activeTabId] || inFlightLoadsRef.current.has(activeTabId)) {
      return;
    }

    if (onLoadFile) {
      onLoadFile(activeTabId);
      return;
    }

    const fsApi = window.electronAPI?.fs;
    if (!fsApi) {
      setLocalLoadErrors((current) => ({ ...current, [activeTabId]: 'Filesystem API unavailable' }));
      return;
    }

    inFlightLoadsRef.current.add(activeTabId);
    setLocalLoadingFiles((current) => ({ ...current, [activeTabId]: true }));
    void fsApi.readFile(activeTabId, 'utf-8')
      .then((content) => {
        if (!isMountedRef.current) {
          return;
        }

        setLocalContentCache((current) => ({ ...current, [activeTabId]: content }));
        setLocalLoadErrors((current) => {
          if (!current[activeTabId]) {
            return current;
          }

          const next = { ...current };
          delete next[activeTabId];
          return next;
        });
      })
      .catch((error: unknown) => {
        if (!isMountedRef.current) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Unable to load file';
        setLocalLoadErrors((current) => ({ ...current, [activeTabId]: message }));
      })
      .finally(() => {
        inFlightLoadsRef.current.delete(activeTabId);

        if (!isMountedRef.current) {
          return;
        }

        setLocalLoadingFiles((current) => ({ ...current, [activeTabId]: false }));
      });
  }, [activeTabId, onLoadFile, resolvedContentCache]);

  const updateContent = (value: string) => {
    if (!activeTabId) {
      return;
    }

    if (onContentChange) {
      onContentChange(activeTabId, value);
      return;
    }

    setLocalContentCache((current) => ({ ...current, [activeTabId]: value }));
  };

  return {
    activeTab,
    code,
    updateContent,
  };
}