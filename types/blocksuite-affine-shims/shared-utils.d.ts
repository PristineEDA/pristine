import type { Store, Workspace } from './store';

export function createDefaultDoc(collection: Workspace, options?: { id?: string; title?: string }): Store;
