import type { ExtensionType, Workspace } from './store';

export class TestWorkspace implements Workspace {
  storeExtensions: ExtensionType[];
  meta: {
    initialize: () => void;
  };
  constructor(options?: { id?: string });
  createDoc: (docId?: string) => unknown;
  getDoc: (docId: string) => unknown | null;
  dispose: () => void;
}
