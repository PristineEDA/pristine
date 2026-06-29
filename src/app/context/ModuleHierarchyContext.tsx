import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useModuleHierarchyStore } from './useModuleHierarchyStore';

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
  const top = useModuleHierarchyStore((state) => state.top);
  const setTop = useModuleHierarchyStore((state) => state.setTop);
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
