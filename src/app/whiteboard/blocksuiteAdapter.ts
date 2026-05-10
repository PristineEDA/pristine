import { ViewExtensionManager } from '@blocksuite/affine/ext-loader';
import { getInternalViewExtensions } from '@blocksuite/affine/extensions/view';
import { ColorScheme, type DocMode } from '@blocksuite/affine/model';
import {
  DocModeExtension,
  EditorSettingExtension,
  FontConfigExtension,
  GeneralSettingSchema,
  ParseDocUrlExtension,
  ThemeExtensionIdentifier,
  type DocModeProvider,
} from '@blocksuite/affine/shared/services';
import type { BlockStdScope } from '@blocksuite/affine/std';
import type { ExtensionType, Store, Workspace } from '@blocksuite/affine/store';
import { signal } from '@preact/signals-core';
import { Subject } from 'rxjs';
import {
  createPristineEdgelessEditorElement,
  runWithCustomElementDefinitionGuard,
  type PristineEdgelessEditorElement,
} from './blocksuiteRuntime';

export interface MountBlockSuiteWhiteboardOptions {
  host: HTMLElement;
  store: Store;
  workspace: Workspace;
}

export interface MountedBlockSuiteWhiteboard {
  container: PristineAffineEditorContainer;
  editor: PristineEdgelessEditorElement;
  dispose: () => void;
}

export interface PristineAffineEditorContainer extends HTMLDivElement {
  page: Store;
  doc: Store;
  host: HTMLElement | null;
  model: Store['root'];
  mode: DocMode;
  origin: HTMLDivElement;
  std: BlockStdScope | null;
  updateComplete: Promise<boolean>;
}

function createDocModeProvider(initialMode: DocMode): DocModeProvider {
  let editorMode: DocMode = initialMode;
  const primaryModes = new Map<string, DocMode>();
  const primaryModeChanges = new Map<string, Subject<DocMode>>();

  const getSubject = (docId: string) => {
    let subject = primaryModeChanges.get(docId);

    if (!subject) {
      subject = new Subject<DocMode>();
      primaryModeChanges.set(docId, subject);
    }

    return subject;
  };

  return {
    getEditorMode: () => editorMode,
    getPrimaryMode: (docId) => primaryModes.get(docId) ?? initialMode,
    onPrimaryModeChange: (handler, docId) => getSubject(docId).subscribe(handler),
    setEditorMode: (mode) => {
      editorMode = mode;
    },
    setPrimaryMode: (mode, docId) => {
      primaryModes.set(docId, mode);
      getSubject(docId).next(mode);
    },
    togglePrimaryMode: (docId) => {
      const nextMode: DocMode = primaryModes.get(docId) === 'page' ? 'edgeless' : 'page';
      primaryModes.set(docId, nextMode);
      getSubject(docId).next(nextMode);
      return nextMode;
    },
  };
}

function createPristineWhiteboardExtensions(store: Store, workspace: Workspace): ExtensionType[] {
  const viewManager = new ViewExtensionManager(getInternalViewExtensions());
  const viewExtensions = runWithCustomElementDefinitionGuard(() => viewManager.get('edgeless'));
  const editorSettings = signal(GeneralSettingSchema.parse({}));
  const lightTheme = signal(ColorScheme.Light);
  const docModeProvider = createDocModeProvider('edgeless');
  docModeProvider.setPrimaryMode('edgeless', store.id);

  return [
    ...viewExtensions,
    DocModeExtension(docModeProvider),
    EditorSettingExtension({ setting$: editorSettings }),
    FontConfigExtension([]),
    ParseDocUrlExtension({
      parseDocUrl: (url) => {
        const docId = url.startsWith('#') ? url.slice(1) : new URL(url, window.location.href).hash.slice(1);

        if (!docId || !workspace.getDoc(docId)) {
          return undefined;
        }

        return { docId };
      },
    }),
    {
      setup: (di) => {
        di.addImpl(ThemeExtensionIdentifier, () => ({
          getAppTheme: () => lightTheme,
          getEdgelessTheme: () => lightTheme,
        }));
      },
    },
  ];
}

function createEditorContainer(store: Store, editor: PristineEdgelessEditorElement): PristineAffineEditorContainer {
  const container = document.createElement('div') as PristineAffineEditorContainer;

  container.className = 'pristine-affine-editor-shell edgeless-mode';
  container.dataset.affineEditorContainer = '';
  Object.assign(container.style, {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '0',
    minWidth: '0',
    overflowX: 'clip',
    width: '100%',
  });

  Object.defineProperties(container, {
    page: {
      get: () => store,
    },
    doc: {
      get: () => store,
    },
    host: {
      get: () => editor.host,
    },
    model: {
      get: () => store.root,
    },
    mode: {
      get: () => 'edgeless' satisfies DocMode,
    },
    origin: {
      get: () => container,
    },
    std: {
      get: () => editor.std,
    },
    updateComplete: {
      get: () => editor.updateComplete,
    },
  });

  return container;
}

export function mountBlockSuiteWhiteboard({
  host,
  store,
  workspace,
}: MountBlockSuiteWhiteboardOptions): MountedBlockSuiteWhiteboard {
  const editor = createPristineEdgelessEditorElement();
  const container = createEditorContainer(store, editor);
  let disposed = false;

  editor.dataset.testid = 'whiteboard-edgeless-editor';
  editor.dataset.theme = 'light';
  Object.assign(editor.style, {
    flex: '1 1 0',
    minHeight: '0',
    minWidth: '0',
  });
  editor.specs = createPristineWhiteboardExtensions(store, workspace);
  editor.doc = store;
  container.replaceChildren(editor);
  host.replaceChildren(container);

  editor.updateComplete
    .then(() => {
      if (disposed) {
        return;
      }

      editor.querySelector<HTMLElement>('affine-edgeless-root')?.click();
    })
    .catch(console.error);

  return {
    container,
    editor,
    dispose: () => {
      disposed = true;
      editor.doc = null;
      editor.specs = [];
      container.remove();
      host.replaceChildren();
    },
  };
}
