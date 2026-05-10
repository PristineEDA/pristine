import { SignalWatcher, WithDisposable } from '@blocksuite/affine/global/lit';
import { BlockStdScope, ShadowlessElement } from '@blocksuite/affine/std';
import { effects as stdEffects } from '@blocksuite/affine/std/effects';
import type { ExtensionType, Store } from '@blocksuite/affine/store';
import { computed, signal } from '@preact/signals-core';
import { css, html, nothing } from 'lit';
import { guard } from 'lit/directives/guard.js';

export const PRISTINE_EDGELESS_EDITOR_TAG = 'pristine-edgeless-editor';

export type PristineEdgelessEditorElement = PristineEdgelessEditor & HTMLElement;

let runtimeReady = false;

export function runWithCustomElementDefinitionGuard<T>(callback: () => T): T {
  if (typeof customElements === 'undefined') {
    return callback();
  }

  const registry = customElements as CustomElementRegistry & {
    define: CustomElementRegistry['define'];
  };
  const originalDefine = registry.define;

  registry.define = ((name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions) => {
    if (registry.get(name)) {
      return;
    }

    originalDefine.call(registry, name, constructor, options);
  }) as CustomElementRegistry['define'];

  try {
    return callback();
  } finally {
    registry.define = originalDefine;
  }
}

export function ensureBlockSuiteRuntimeReady() {
  if (runtimeReady) {
    return;
  }

  runWithCustomElementDefinitionGuard(() => {
    stdEffects();

    if (!customElements.get(PRISTINE_EDGELESS_EDITOR_TAG)) {
      customElements.define(PRISTINE_EDGELESS_EDITOR_TAG, PristineEdgelessEditor);
    }
  });

  runtimeReady = true;
}

export function createPristineEdgelessEditorElement() {
  ensureBlockSuiteRuntimeReady();
  return document.createElement(PRISTINE_EDGELESS_EDITOR_TAG) as PristineEdgelessEditorElement;
}

class PristineEdgelessEditor extends SignalWatcher(WithDisposable(ShadowlessElement)) {
  static override styles = css`
    pristine-edgeless-editor {
      display: block;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      color-scheme: light;
      isolation: isolate;
      background: var(--affine-background-primary-color, #ffffff);
      color: var(--affine-text-primary-color, #121212);
      font-family: var(--affine-font-family, Inter, ui-sans-serif, system-ui, sans-serif);
    }

    pristine-edgeless-editor *,
    pristine-edgeless-editor *::before,
    pristine-edgeless-editor *::after {
      box-sizing: border-box;
      border-color: var(--affine-border-color, #e3e2e4);
      outline-color: var(--affine-primary-color, #1e96eb);
    }

    pristine-edgeless-editor button,
    pristine-edgeless-editor input,
    pristine-edgeless-editor label,
    pristine-edgeless-editor select,
    pristine-edgeless-editor textarea {
      font-family: inherit;
    }

    pristine-edgeless-editor > .pristine-edgeless-viewport {
      position: relative;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }

    pristine-edgeless-editor editor-host,
    pristine-edgeless-editor affine-edgeless-root,
    pristine-edgeless-editor gfx-viewport {
      display: block;
      width: 100%;
      height: 100%;
    }
  `;

  private _mountedStd: BlockStdScope | null = null;

  private readonly _doc = signal<Store | null>(null);

  private readonly _specs = signal<ExtensionType[]>([]);

  private readonly _std = computed(() => {
    const doc = this._doc.value;

    if (!doc) {
      return null;
    }

    return new BlockStdScope({
      store: doc,
      extensions: this._specs.value,
    });
  });

  get doc() {
    return this._doc.value;
  }

  set doc(doc: Store | null) {
    this._unmountCurrentStd();
    this._doc.value = doc;
  }

  get specs() {
    return this._specs.value;
  }

  set specs(specs: ExtensionType[]) {
    this._unmountCurrentStd();
    this._specs.value = specs;
  }

  get editorHost() {
    return this._std.peek()?.host ?? null;
  }

  override connectedCallback() {
    super.connectedCallback();

    const doc = this._doc.peek();
    if (doc) {
      this._disposables.add(doc.slots.rootAdded.subscribe(() => this.requestUpdate()));
    }
  }

  override disconnectedCallback() {
    this._unmountCurrentStd();
    super.disconnectedCallback();
  }

  override updated() {
    const std = this._std.peek();

    if (!std || this._mountedStd === std) {
      return;
    }

    try {
      void std.host;
    } catch {
      return;
    }

    this._mountedStd?.unmount();
    std.mount();
    this._mountedStd = std;
  }

  private _unmountCurrentStd() {
    this._mountedStd?.unmount();
    this._mountedStd = null;
  }

  override render() {
    const doc = this._doc.value;
    const std = this._std.value;

    if (!doc?.root || !std) {
      return nothing;
    }

    return html`
      <div class="pristine-edgeless-viewport">
        ${guard([std], () => std.render())}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [PRISTINE_EDGELESS_EDITOR_TAG]: PristineEdgelessEditor;
  }
}
