import { LitElement } from 'lit';
import type { ExtensionType, Store } from './store';

export class ShadowlessElement extends LitElement {}

export class BlockStdScope {
  constructor(options: { store: Store; extensions: ExtensionType[] });
  readonly host: HTMLElement;
  render: () => HTMLElement;
  mount: () => void;
  unmount: () => void;
}
