import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { refreshWorkspaceGitStatus } from '../git/workspaceGitStatus';

export interface SaveFilesResult {
  savedFileIds: string[];
  failedFileIds: string[];
}

export function useWorkspaceFileStore() {
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [savedFileContents, setSavedFileContents] = useState<Record<string, string>>({});
  const [loadingFiles, setLoadingFiles] = useState<Record<string, boolean>>({});
  const [savingFiles, setSavingFiles] = useState<Record<string, boolean>>({});
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const fileContentsRef = useRef<Record<string, string>>({});
  const savedFileContentsRef = useRef<Record<string, string>>({});
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
        setSavedFileContents((current) => {
          if (current[fileId] === content) {
            return current;
          }

          const next = { ...current, [fileId]: content };
          savedFileContentsRef.current = next;
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
        setSaveErrors((current) => {
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

    setSaveErrors((current) => {
      if (!current[fileId]) {
        return current;
      }

      const next = { ...current };
      delete next[fileId];
      return next;
    });
  }, []);

  const discardFiles = useCallback((fileIds: string[]) => {
    const uniqueFileIds = Array.from(new Set(fileIds.filter(Boolean)));
    if (uniqueFileIds.length === 0) {
      return;
    }

    setFileContents((current) => {
      let changed = false;
      const next = { ...current };

      uniqueFileIds.forEach((fileId) => {
        const savedContent = savedFileContentsRef.current[fileId];
        if (savedContent === undefined) {
          return;
        }

        if (next[fileId] === savedContent) {
          return;
        }

        next[fileId] = savedContent;
        changed = true;
      });

      if (!changed) {
        return current;
      }

      fileContentsRef.current = next;
      return next;
    });

    setSaveErrors((current) => {
      let changed = false;
      const next = { ...current };

      uniqueFileIds.forEach((fileId) => {
        if (!next[fileId]) {
          return;
        }

        delete next[fileId];
        changed = true;
      });

      return changed ? next : current;
    });
  }, []);

  const saveFileContentInternal = useCallback(async (fileId: string, refreshGitStatusAfterSuccess: boolean) => {
    if (!fileId) {
      return false;
    }

    const currentContent = fileContentsRef.current[fileId];
    const savedContent = savedFileContentsRef.current[fileId];
    if (currentContent === undefined) {
      return false;
    }

    if (currentContent === savedContent) {
      setSaveErrors((current) => {
        if (!current[fileId]) {
          return current;
        }

        const next = { ...current };
        delete next[fileId];
        return next;
      });
      return true;
    }

    const fsApi = window.electronAPI?.fs;
    if (!fsApi) {
      setSaveErrors((current) => ({ ...current, [fileId]: 'Filesystem API unavailable' }));
      return false;
    }

    setSavingFiles((current) => ({ ...current, [fileId]: true }));
    setSaveErrors((current) => {
      if (!current[fileId]) {
        return current;
      }

      const next = { ...current };
      delete next[fileId];
      return next;
    });

    try {
      await fsApi.writeFile(fileId, currentContent);

      if (!isMountedRef.current) {
        return true;
      }

      setSavedFileContents((current) => {
        if (current[fileId] === currentContent) {
          return current;
        }

        const next = { ...current, [fileId]: currentContent };
        savedFileContentsRef.current = next;
        return next;
      });

      if (refreshGitStatusAfterSuccess) {
        refreshWorkspaceGitStatus();
      }

      return true;
    } catch (error: unknown) {
      if (isMountedRef.current) {
        const message = error instanceof Error ? error.message : 'Unable to save file';
        setSaveErrors((current) => ({ ...current, [fileId]: message }));
      }

      return false;
    } finally {
      if (!isMountedRef.current) {
        return;
      }

      setSavingFiles((current) => ({ ...current, [fileId]: false }));
    }
  }, []);

  const saveFileContent = useCallback(async (fileId: string) => {
    return saveFileContentInternal(fileId, true);
  }, [saveFileContentInternal]);

  const saveFiles = useCallback(async (fileIds: string[]): Promise<SaveFilesResult> => {
    const uniqueFileIds = Array.from(new Set(fileIds.filter(Boolean)));
    if (uniqueFileIds.length === 0) {
      return {
        savedFileIds: [],
        failedFileIds: [],
      };
    }

    const results = await Promise.all(uniqueFileIds.map(async (fileId) => ({
      fileId,
      saved: await saveFileContentInternal(fileId, false),
    })));

    if (results.some((result) => result.saved)) {
      refreshWorkspaceGitStatus();
    }

    return {
      savedFileIds: results.filter((result) => result.saved).map((result) => result.fileId),
      failedFileIds: results.filter((result) => !result.saved).map((result) => result.fileId),
    };
  }, [saveFileContentInternal]);

  const dirtyFiles = useMemo(() => {
    const dirtyEntries = new Set([
      ...Object.keys(fileContents),
      ...Object.keys(savedFileContents),
    ]);

    return Array.from(dirtyEntries).reduce<Record<string, boolean>>((current, fileId) => {
      current[fileId] = fileContents[fileId] !== undefined && fileContents[fileId] !== savedFileContents[fileId];
      return current;
    }, {});
  }, [fileContents, savedFileContents]);

  const dirtyFileIds = useMemo(
    () => Object.keys(dirtyFiles).filter((fileId) => dirtyFiles[fileId]),
    [dirtyFiles],
  );

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useEffect(() => {
    fileContentsRef.current = fileContents;
  }, [fileContents]);

  useEffect(() => {
    savedFileContentsRef.current = savedFileContents;
  }, [savedFileContents]);

  return {
    dirtyFileIds,
    dirtyFiles,
    discardFiles,
    fileContents,
    loadErrors,
    loadFileContent,
    loadingFiles,
    saveErrors,
    saveFileContent,
    saveFiles,
    savingFiles,
    updateFileContent,
  };
}