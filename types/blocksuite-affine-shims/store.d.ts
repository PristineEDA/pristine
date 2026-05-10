import type { Subscription } from 'rxjs';

export interface ExtensionType {
  setup: (di: any) => void;
}

export interface Store {
  id: string;
  root: unknown | null;
  workspace: Workspace;
  provider: unknown;
  slots: {
    rootAdded: {
      subscribe: (handler: () => void) => Subscription;
    };
  };
  dispose: () => void;
  get: <T>(extension: new (...args: any[]) => T) => T;
}

export interface Workspace {
  storeExtensions: ExtensionType[];
  meta: {
    initialize: () => void;
  };
  getDoc: (docId: string) => unknown | null;
  dispose?: () => void;
}
