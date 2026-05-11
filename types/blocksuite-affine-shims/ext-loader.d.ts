import type { ExtensionType } from './store';

export class StoreExtensionManager {
  constructor(providers: Array<new (...args: any[]) => unknown>);
  get: (scope: 'store') => ExtensionType[];
}

export class ViewExtensionManager {
  constructor(providers: Array<new (...args: any[]) => unknown>);
  get: (scope: 'page' | 'edgeless' | 'preview-page' | 'preview-edgeless' | 'mobile-page' | 'mobile-edgeless') => ExtensionType[];
}
