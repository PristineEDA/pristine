import { SignalWatcher, WithDisposable } from '@blocksuite/affine/global/lit';
import { ThemeProvider } from '@blocksuite/affine/shared/services';
import { BlockStdScope, ShadowlessElement } from '@blocksuite/affine/std';
import { effects as stdEffects } from '@blocksuite/affine/std/effects';
import type { ExtensionType, Store } from '@blocksuite/affine/store';
import type { Subscription } from 'rxjs';
import { css, html, nothing } from 'lit';
import { guard } from 'lit/directives/guard.js';

export const PRISTINE_EDGELESS_EDITOR_TAG = 'edgeless-editor';

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
    edgeless-editor {
      font-family: var(--affine-font-family);
      background: var(--affine-background-primary-color);
      display: block;
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
      color-scheme: light;
    }

    edgeless-editor * {
      box-sizing: border-box;
    }

    @media print {
      edgeless-editor {
        height: auto;
      }
    }

    .affine-edgeless-viewport {
      display: block;
      height: 100%;
      position: relative;
      overflow: clip;
      container-name: viewport;
      container-type: inline-size;
    }

    edgeless-editor editor-host,
    edgeless-editor affine-edgeless-root,
    edgeless-editor gfx-viewport {
      display: block;
      width: 100%;
      height: 100%;
    }
  `;

  private _mountedStd: BlockStdScope | null = null;

  private _doc: Store | null = null;

  private _rootAddedSubscription: Subscription | null = null;

  private _specs: ExtensionType[] = [];

  std: BlockStdScope | null = null;

  get doc() {
    return this._doc;
  }

  set doc(doc: Store | null) {
    if (this._doc === doc) {
      return;
    }

    this._doc = doc;
    this._recreateStd();
  }

  get specs() {
    return this._specs;
  }

  set specs(specs: ExtensionType[]) {
    if (this._specs === specs) {
      return;
    }

    this._specs = specs;
    this._recreateStd();
  }

  get host() {
    try {
      return this.std?.host ?? null;
    } catch {
      return null;
    }
  }

  get editorHost() {
    return this.host;
  }

  override connectedCallback() {
    super.connectedCallback();
    this._recreateStd();
  }

  override async getUpdateComplete(): Promise<boolean> {
    const result = await super.getUpdateComplete();
    await (this.host as (HTMLElement & { updateComplete?: Promise<unknown> }) | null)?.updateComplete;
    return result;
  }

  override disconnectedCallback() {
    this._rootAddedSubscription?.unsubscribe();
    this._rootAddedSubscription = null;
    this._unmountCurrentStd();
    super.disconnectedCallback();
  }

  override updated() {
    const std = this.std;

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

  private _recreateStd() {
    this._rootAddedSubscription?.unsubscribe();
    this._rootAddedSubscription = null;
    this._unmountCurrentStd();

    if (!this._doc) {
      this.std = null;
      this.requestUpdate();
      return;
    }

    this.std = new BlockStdScope({
      store: this._doc,
      extensions: this._specs,
    });
    this._rootAddedSubscription = this._doc.slots.rootAdded.subscribe(() => this.requestUpdate());
    this.requestUpdate();
  }

  private _unmountCurrentStd() {
    this._mountedStd?.unmount();
    this._mountedStd = null;
  }

  override render() {
    const doc = this._doc;
    const std = this.std;

    if (!doc?.root || !std) {
      return nothing;
    }

    const theme = std.get(ThemeProvider).edgeless$.value;

    return html`
      <div class="affine-edgeless-viewport" data-theme=${theme}>
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
