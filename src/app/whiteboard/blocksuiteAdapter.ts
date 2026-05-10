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
import type { ExtensionType, Store, Workspace } from '@blocksuite/affine/store';
import { signal } from '@preact/signals-core';
import { Subject } from 'rxjs';
import {
  createPristineEdgelessEditorElement,
  runWithCustomElementDefinitionGuard,
  type PristineEdgelessEditorElement,
} from './blocksuiteRuntime';

export interface MountBlockSuiteWhiteboardOptions {
  host: HTMLElement | ShadowRoot;
  store: Store;
  workspace: Workspace;
}

export interface MountedBlockSuiteWhiteboard {
  editor: PristineEdgelessEditorElement;
  dispose: () => void;
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

function createPristineWhiteboardExtensions(workspace: Workspace): ExtensionType[] {
  const viewManager = new ViewExtensionManager(getInternalViewExtensions());
  const viewExtensions = runWithCustomElementDefinitionGuard(() => viewManager.get('edgeless'));
  const editorSettings = signal(GeneralSettingSchema.parse({}));
  const lightTheme = signal(ColorScheme.Light);

  return [
    ...viewExtensions,
    DocModeExtension(createDocModeProvider('edgeless')),
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

export function mountBlockSuiteWhiteboard({
  host,
  store,
  workspace,
}: MountBlockSuiteWhiteboardOptions): MountedBlockSuiteWhiteboard {
  const editor = createPristineEdgelessEditorElement();
  editor.dataset.testid = 'whiteboard-edgeless-editor';
  editor.dataset.theme = 'light';
  editor.classList.add('affine-edgeless-viewport');
  editor.doc = store;
  editor.specs = createPristineWhiteboardExtensions(workspace);
  host.replaceChildren(editor);

  return {
    editor,
    dispose: () => {
      editor.doc = null;
      editor.specs = [];
      editor.remove();
      host.replaceChildren();
    },
  };
}
