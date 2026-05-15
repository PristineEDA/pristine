import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type CodeViewerLayoutMode = 'compact' | 'minimal';

export const DEFAULT_CODE_VIEWER_LAYOUT_MODE: CodeViewerLayoutMode = 'compact';
export const WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY = 'workbench.codeViewerLayoutMode';

interface CodeViewerLayoutContextValue {
  layoutMode: CodeViewerLayoutMode;
  setLayoutMode: (layoutMode: CodeViewerLayoutMode) => void;
}

const CodeViewerLayoutContext = createContext<CodeViewerLayoutContextValue | null>(null);

const fallbackCodeViewerLayoutContextValue: CodeViewerLayoutContextValue = {
  layoutMode: DEFAULT_CODE_VIEWER_LAYOUT_MODE,
  setLayoutMode: () => undefined,
};

export function parseCodeViewerLayoutMode(value: unknown): CodeViewerLayoutMode {
  return value === 'minimal' ? 'minimal' : DEFAULT_CODE_VIEWER_LAYOUT_MODE;
}

function readConfiguredCodeViewerLayoutMode(): CodeViewerLayoutMode {
  try {
    return parseCodeViewerLayoutMode(window.electronAPI?.config.get(WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY));
  } catch {
    return DEFAULT_CODE_VIEWER_LAYOUT_MODE;
  }
}

export function CodeViewerLayoutProvider({ children }: { children: ReactNode }) {
  const [layoutMode, setLayoutModeState] = useState<CodeViewerLayoutMode>(readConfiguredCodeViewerLayoutMode);

  const setLayoutMode = useCallback((nextLayoutMode: CodeViewerLayoutMode) => {
    const parsedLayoutMode = parseCodeViewerLayoutMode(nextLayoutMode);

    setLayoutModeState(parsedLayoutMode);

    try {
      void window.electronAPI?.config.set(WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY, parsedLayoutMode);
    } catch {
    }
  }, []);

  useEffect(() => {
    const dispose = window.electronAPI?.config.onDidChange?.((configKey, value) => {
      if (configKey !== WORKBENCH_CODE_VIEWER_LAYOUT_MODE_CONFIG_KEY) {
        return;
      }

      setLayoutModeState(parseCodeViewerLayoutMode(value));
    });

    return () => {
      dispose?.();
    };
  }, []);

  const value = useMemo<CodeViewerLayoutContextValue>(() => ({
    layoutMode,
    setLayoutMode,
  }), [layoutMode, setLayoutMode]);

  return (
    <CodeViewerLayoutContext.Provider value={value}>
      {children}
    </CodeViewerLayoutContext.Provider>
  );
}

export function useCodeViewerLayout() {
  const context = useContext(CodeViewerLayoutContext);

  return context ?? fallbackCodeViewerLayoutContextValue;
}