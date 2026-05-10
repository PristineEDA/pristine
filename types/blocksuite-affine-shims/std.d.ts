import { LitElement } from 'lit';
import type { ExtensionType, Store } from './store';

export class ShadowlessElement extends LitElement {}

export class BlockStdScope {
  constructor(options: { store: Store; extensions: ExtensionType[] });
  readonly host: HTMLElement;
  readonly store: Store;
  render: () => HTMLElement;
  mount: () => void;
  unmount: () => void;
  get: <T = any>(identifier: unknown) => T;
  getOptional: <T = any>(identifier: unknown) => T | undefined;
}
