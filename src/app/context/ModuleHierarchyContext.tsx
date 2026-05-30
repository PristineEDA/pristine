import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type ModuleHierarchyTopKind = 'auto' | 'manual';

export interface ModuleHierarchyTop {
  rootKey: string;
  moduleName: string;
  instanceName?: string;
  filePath?: string;
  uri?: string;
  kind: ModuleHierarchyTopKind;
}

interface ModuleHierarchyContextValue {
  top: ModuleHierarchyTop | null;
  setTop: (top: ModuleHierarchyTop | null) => void;
}

const ModuleHierarchyContext = createContext<ModuleHierarchyContextValue>({
  top: null,
  setTop: () => undefined,
});

export function ModuleHierarchyProvider({ children }: { children: ReactNode }) {
  const [top, setTop] = useState<ModuleHierarchyTop | null>(null);
  const value = useMemo<ModuleHierarchyContextValue>(() => ({ top, setTop }), [top]);

  return (
    <ModuleHierarchyContext.Provider value={value}>
      {children}
    </ModuleHierarchyContext.Provider>
  );
}

export function useModuleHierarchy(): ModuleHierarchyContextValue {
  return useContext(ModuleHierarchyContext);
}