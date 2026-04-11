import { useCallback, useEffect, useRef, useState } from 'react';

export function useWorkspaceFileStore() {
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const fileContentsRef = useRef<Record<string, string>>({});
  const inFlightLoadsRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);

  const loadFileContent = useCallback((fileId: string) => {
    if (!fileId || fileContentsRef.current[fileId] !== undefined || inFlightLoadsRef.current.has(fileId)) {
      return;
    }

    const fsApi = window.electronAPI?.fs;
    if (!fsApi) {
      setLoadErrors((current) => ({ ...current, [fileId]: 'Filesystem API unavailable' }));
      return;
    }

    inFlightLoadsRef.current.add(fileId);
    setLoadingFiles((current) => ({ ...current, [fileId]: true }));

    void fsApi.readFile(fileId, 'utf-8')
      .then((content) => {
        if (!isMountedRef.current) {
          return;
        }

        setFileContents((current) => {
          if (current[fileId] === content) {
            return current;
          }

          const next = { ...current, [fileId]: content };
          fileContentsRef.current = next;
          return next;
        });
        setLoadErrors((current) => {
          if (!current[fileId]) {
            return current;
          }

          const next = { ...current };
          delete next[fileId];
          return next;
        });
      })
      .catch((error: unknown) => {
        if (!isMountedRef.current) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Unable to load file';
        setLoadErrors((current) => ({ ...current, [fileId]: message }));
      })
      .finally(() => {
        inFlightLoadsRef.current.delete(fileId);
        if (!isMountedRef.current) {
          return;
        }

        setLoadingFiles((current) => ({ ...current, [fileId]: false }));
      });
  }, []);

  const updateFileContent = useCallback((fileId: string, content: string) => {
    setFileContents((current) => {
      if (current[fileId] === content) {
        return current;
      }

      const next = { ...current, [fileId]: content };
      fileContentsRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useEffect(() => {
    fileContentsRef.current = fileContents;
  }, [fileContents]);

  return {
    fileContents,
    loadErrors,
    loadFileContent,
    loadingFiles,
    updateFileContent,
  };
}