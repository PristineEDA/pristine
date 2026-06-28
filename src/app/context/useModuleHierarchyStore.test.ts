import { beforeEach, describe, expect, it } from 'vitest';
import {
  resetModuleHierarchyStoreForTests,
  useModuleHierarchyStore,
} from './useModuleHierarchyStore';
import type { ModuleHierarchyTop } from './ModuleHierarchyContext';

const manualTop: ModuleHierarchyTop = {
  filePath: 'rtl/core/cpu_top.sv',
  kind: 'manual',
  moduleName: 'cpu_top',
  rootKey: 'manual:cpu_top',
  uri: 'file:///workspace/rtl/core/cpu_top.sv',
};

describe('useModuleHierarchyStore', () => {
  beforeEach(() => {
    resetModuleHierarchyStoreForTests();
  });

  it('starts without a selected hierarchy top', () => {
    expect(useModuleHierarchyStore.getState().top).toBeNull();
  });

  it('stores and resets the selected hierarchy top', () => {
    useModuleHierarchyStore.getState().setTop(manualTop);

    expect(useModuleHierarchyStore.getState().top).toEqual(manualTop);

    useModuleHierarchyStore.getState().resetTop();

    expect(useModuleHierarchyStore.getState().top).toBeNull();
  });
});
