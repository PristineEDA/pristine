import type {
  LspCompletionItem,
  LspCompletionResponse,
  LspDebugEvent,
  LspDiagnostic,
  LspHover,
  LspMarkedString,
  LspMarkupContent,
  LspTextEdit,
  WorkspaceLocation,
} from '../../../types/systemverilog-lsp';
import { normalizeWorkspacePath } from '../workspace/workspaceFiles';

const CHANGE_DEBOUNCE_MS = 120;
const DEBUG_EVENT_LIMIT = 200;
const LSP_MARKER_OWNER = 'slang-lsp';
const LSP_PROVIDER_REGISTRATION_MARKER = '__pristineSystemVerilogLspProvidersRegistered';

type NavigateToLocation = (filePath: string, line: number, col: number) => void;

interface TrackedDocument {
  refCount: number;
  text: string;
  pendingText: string | null;
  pendingTimer: ReturnType<typeof setTimeout> | null;
  models: Set<any>;
}

function getLspApi() {
  return window.electronAPI?.lsp;
}

function getModelPath(model: any, modelFilePaths: WeakMap<any, string>): string | null {
  const trackedPath = modelFilePaths.get(model);
  if (trackedPath) {
    return trackedPath;
  }

  const rawPath = typeof model?.uri?.path === 'string'
    ? model.uri.path
    : typeof model?.uri?.fsPath === 'string'
    ? model.uri.fsPath
    : null;

  if (!rawPath) {
    return null;
  }

  return normalizeWorkspacePath(rawPath);
}

function toMonacoRange(range: WorkspaceLocation['range']) {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
}

function toMonacoMarkerSeverity(monaco: any, severity?: number) {
  switch (severity) {
    case 1:
      return monaco.MarkerSeverity.Error;
    case 2:
      return monaco.MarkerSeverity.Warning;
    case 3:
      return monaco.MarkerSeverity.Info;
    case 4:
      return monaco.MarkerSeverity.Hint;
    default:
      return monaco.MarkerSeverity.Info;
  }
}

function toMonacoCompletionKind(monaco: any, kind?: number) {
  switch (kind) {
    case 2:
      return monaco.languages.CompletionItemKind.Method;
    case 3:
      return monaco.languages.CompletionItemKind.Function;
    case 4:
      return monaco.languages.CompletionItemKind.Constructor;
    case 5:
      return monaco.languages.CompletionItemKind.Field;
    case 6:
      return monaco.languages.CompletionItemKind.Variable;
    case 7:
      return monaco.languages.CompletionItemKind.Class;
    case 8:
      return monaco.languages.CompletionItemKind.Interface;
    case 9:
      return monaco.languages.CompletionItemKind.Module;
    case 10:
      return monaco.languages.CompletionItemKind.Property;
    case 11:
      return monaco.languages.CompletionItemKind.Unit;
    case 12:
      return monaco.languages.CompletionItemKind.Value;
    case 13:
      return monaco.languages.CompletionItemKind.Enum;
    case 14:
      return monaco.languages.CompletionItemKind.Keyword;
    case 15:
      return monaco.languages.CompletionItemKind.Snippet;
    case 16:
      return monaco.languages.CompletionItemKind.Color;
    case 17:
      return monaco.languages.CompletionItemKind.File;
    case 18:
      return monaco.languages.CompletionItemKind.Reference;
    case 19:
      return monaco.languages.CompletionItemKind.Folder;
    case 20:
      return monaco.languages.CompletionItemKind.EnumMember;
    case 21:
      return monaco.languages.CompletionItemKind.Constant;
    case 22:
      return monaco.languages.CompletionItemKind.Struct;
    case 23:
      return monaco.languages.CompletionItemKind.Event;
    case 24:
      return monaco.languages.CompletionItemKind.Operator;
    case 25:
      return monaco.languages.CompletionItemKind.TypeParameter;
    default:
      return monaco.languages.CompletionItemKind.Text;
  }
}

function toMonacoTextEdit(edit: LspTextEdit) {
  return {
    range: toMonacoRange(edit.range),
    text: edit.newText,
  };
}

function formatMarkedString(value: LspMarkedString | LspMarkupContent) {
  if ('kind' in value) {
    return value.value;
  }

  return `\`\`\`${value.language}\n${value.value}\n\`\`\``;
}

function formatHoverContents(value: LspHover['contents'] | LspCompletionItem['documentation']): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => formatHoverContents(entry)).filter(Boolean).join('\n\n');
  }

  return formatMarkedString(value);
}

function getCompletionItems(response: LspCompletionResponse | null): LspCompletionItem[] {
  if (!response) {
    return [];
  }

  return Array.isArray(response) ? response : response.items;
}

class SystemVerilogLspBridge {
  private diagnosticsByFile = new Map<string, LspDiagnostic[]>();

  private debugEvents: LspDebugEvent[] = [];

  private trackedDocuments = new Map<string, TrackedDocument>();

  private modelFilePaths = new WeakMap<any, string>();

  private editorNavigationHandlers = new WeakMap<any, NavigateToLocation | undefined>();

  private diagnosticsSubscriptionInstalled = false;

  private debugSubscriptionInstalled = false;

  private stateSubscriptionInstalled = false;

  private debugListeners = new Set<() => void>();

  private loggedErrorMessage: string | null = null;

  private notifyDebugListeners() {
    this.debugListeners.forEach((listener) => {
      listener();
    });
  }

  private appendDebugEvent(event: LspDebugEvent) {
    this.debugEvents = [...this.debugEvents, event].slice(-DEBUG_EVENT_LIMIT);
    this.notifyDebugListeners();
  }

  getDebugEvents() {
    return this.debugEvents;
  }

  subscribeToDebugEvents(listener: () => void) {
    this.debugListeners.add(listener);
    return () => {
      this.debugListeners.delete(listener);
    };
  }

  private handleError(error: unknown) {
    const message = error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : 'SystemVerilog LSP request failed';
    if (this.loggedErrorMessage === message) {
      return;
    }

    this.loggedErrorMessage = message;
    console.error(message);
  }

  private ensureStreamSubscriptions(monaco: any) {
    const api = getLspApi();
    if (!api) {
      return;
    }

    if (!this.diagnosticsSubscriptionInstalled) {
      api.onDiagnostics((payload) => {
        const filePath = normalizeWorkspacePath(payload.filePath);
        this.diagnosticsByFile.set(filePath, payload.diagnostics);
        this.applyDiagnostics(monaco, filePath);
      });
      this.diagnosticsSubscriptionInstalled = true;
    }

    if (!this.debugSubscriptionInstalled && typeof api.onDebug === 'function') {
      api.onDebug((payload) => {
        this.appendDebugEvent(payload);
      });
      this.debugSubscriptionInstalled = true;
    }

    if (!this.stateSubscriptionInstalled) {
      api.onState((payload) => {
        if (payload.status !== 'error') {
          return;
        }

        this.handleError(payload.message ?? 'SystemVerilog LSP entered an error state');
      });
      this.stateSubscriptionInstalled = true;
    }
  }

  private ensureEditorActions(monaco: any, editor: any, onNavigateToLocation?: NavigateToLocation) {
    if (!editor?.addAction) {
      return;
    }

    this.editorNavigationHandlers.set(editor, onNavigateToLocation);
    if (editor.__pristineSystemVerilogLspActionsInstalled === true) {
      return;
    }

    editor.__pristineSystemVerilogLspActionsInstalled = true;
    editor.addAction({
      id: 'pristine.systemverilog.goToDefinition',
      label: 'Go to Definition',
      keybindings: monaco?.KeyCode?.F12 ? [monaco.KeyCode.F12] : undefined,
      run: async (currentEditor: any) => {
        const navigate = this.editorNavigationHandlers.get(currentEditor);
        if (!navigate) {
          return;
        }

        const model = currentEditor.getModel?.();
        const position = currentEditor.getPosition?.();
        const filePath = model ? getModelPath(model, this.modelFilePaths) : null;
        if (!model || !position || !filePath) {
          return;
        }

        const locations = await this.requestDefinition(filePath, position);
        const firstLocation = locations[0];
        if (!firstLocation) {
          return;
        }

        navigate(
          firstLocation.filePath,
          firstLocation.range.start.line + 1,
          firstLocation.range.start.character + 1,
        );
      },
    });
  }

  setNavigateHandler(editor: any, onNavigateToLocation?: NavigateToLocation) {
    if (!editor) {
      return;
    }

    this.editorNavigationHandlers.set(editor, onNavigateToLocation);
  }

  private applyDiagnostics(monaco: any, filePath: string) {
    const trackedDocument = this.trackedDocuments.get(filePath);
    if (!trackedDocument) {
      return;
    }

    const diagnostics = this.diagnosticsByFile.get(filePath) ?? [];
    const markers = diagnostics.map((diagnostic) => ({
      severity: toMonacoMarkerSeverity(monaco, diagnostic.severity),
      startLineNumber: diagnostic.range.start.line + 1,
      startColumn: diagnostic.range.start.character + 1,
      endLineNumber: diagnostic.range.end.line + 1,
      endColumn: diagnostic.range.end.character + 1,
      message: diagnostic.message,
      code: diagnostic.code,
      source: diagnostic.source,
    }));

    trackedDocument.models.forEach((model) => {
      monaco.editor.setModelMarkers(model, LSP_MARKER_OWNER, markers);
    });
  }

  private clearModelDiagnostics(monaco: any, model: any) {
    if (!model) {
      return;
    }

    monaco.editor.setModelMarkers(model, LSP_MARKER_OWNER, []);
  }

  private scheduleChange(filePath: string) {
    const trackedDocument = this.trackedDocuments.get(filePath);
    const api = getLspApi();
    if (!trackedDocument || !api) {
      return;
    }

    if (trackedDocument.pendingTimer) {
      clearTimeout(trackedDocument.pendingTimer);
    }

    trackedDocument.pendingTimer = setTimeout(() => {
      trackedDocument.pendingTimer = null;
      const nextText = trackedDocument.pendingText;
      if (nextText === null || trackedDocument.text === nextText) {
        return;
      }

      trackedDocument.pendingText = null;
      trackedDocument.text = nextText;
      void api.changeDocument(filePath, nextText).catch((error) => {
        this.handleError(error);
      });
    }, CHANGE_DEBOUNCE_MS);
  }

  private async requestCompletion(filePath: string, position: { lineNumber: number; column: number }, context: any) {
    const api = getLspApi();
    if (!api) {
      return null;
    }

    try {
      return await api.completion(
        filePath,
        position.lineNumber - 1,
        position.column - 1,
        typeof context?.triggerCharacter === 'string' ? context.triggerCharacter : undefined,
        typeof context?.triggerKind === 'number' ? context.triggerKind : undefined,
      );
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  private async requestHover(filePath: string, position: { lineNumber: number; column: number }) {
    const api = getLspApi();
    if (!api) {
      return null;
    }

    try {
      return await api.hover(filePath, position.lineNumber - 1, position.column - 1);
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  private async requestDefinition(filePath: string, position: { lineNumber: number; column: number }) {
    const api = getLspApi();
    if (!api) {
      return [];
    }

    try {
      return await api.definition(filePath, position.lineNumber - 1, position.column - 1);
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  private async requestReferences(filePath: string, position: { lineNumber: number; column: number }) {
    const api = getLspApi();
    if (!api) {
      return [];
    }

    try {
      return await api.references(filePath, position.lineNumber - 1, position.column - 1, true);
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  ensureRegistered(monaco: any) {
    const api = getLspApi();
    if (!monaco || !api) {
      return;
    }

    this.ensureStreamSubscriptions(monaco);
    if (monaco[LSP_PROVIDER_REGISTRATION_MARKER] === true) {
      return;
    }

    monaco[LSP_PROVIDER_REGISTRATION_MARKER] = true;

    monaco.languages.registerCompletionItemProvider('systemverilog', {
      triggerCharacters: ['.', ':', '`', '$'],
      provideCompletionItems: async (model: any, position: any, context: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return { suggestions: [] };
        }

        const response = await this.requestCompletion(filePath, position, context);
        const suggestions = getCompletionItems(response).map((item) => {
          const defaultRange = model.getWordUntilPosition(position);
          const range = item.textEdit
            ? toMonacoRange(item.textEdit.range)
            : {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: defaultRange.startColumn,
              endColumn: defaultRange.endColumn,
            };

          return {
            label: item.label,
            kind: toMonacoCompletionKind(monaco, item.kind),
            detail: item.detail,
            documentation: item.documentation ? { value: formatHoverContents(item.documentation) } : undefined,
            insertText: item.textEdit?.newText ?? item.insertText ?? item.label,
            range,
            sortText: item.sortText,
            filterText: item.filterText,
            preselect: item.preselect,
            commitCharacters: item.commitCharacters,
            insertTextRules: item.insertTextFormat === 2
              ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
              : undefined,
            additionalTextEdits: item.additionalTextEdits?.map((edit) => toMonacoTextEdit(edit)),
          };
        });

        return { suggestions };
      },
    });

    monaco.languages.registerHoverProvider('systemverilog', {
      provideHover: async (model: any, position: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return null;
        }

        const hover = await this.requestHover(filePath, position);
        if (!hover) {
          return null;
        }

        const formattedContents = formatHoverContents(hover.contents);
        if (!formattedContents) {
          return null;
        }

        return {
          range: hover.range ? toMonacoRange(hover.range) : undefined,
          contents: [{ value: formattedContents }],
        };
      },
    });

    monaco.languages.registerDefinitionProvider('systemverilog', {
      provideDefinition: async (model: any, position: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return [];
        }

        const locations = await this.requestDefinition(filePath, position);
        return locations.map((location) => ({
          uri: monaco.Uri.parse(location.filePath),
          range: toMonacoRange(location.range),
        }));
      },
    });

    monaco.languages.registerReferenceProvider('systemverilog', {
      provideReferences: async (model: any, position: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return [];
        }

        const locations = await this.requestReferences(filePath, position);
        return locations.map((location) => ({
          uri: monaco.Uri.parse(location.filePath),
          range: toMonacoRange(location.range),
        }));
      },
    });
  }

  attachDocument(args: {
    monaco: any;
    editor: any;
    filePath: string;
    text: string;
    onNavigateToLocation?: NavigateToLocation;
  }) {
    const api = getLspApi();
    if (!api) {
      return () => undefined;
    }

    const { monaco, editor, text, onNavigateToLocation } = args;
    const filePath = normalizeWorkspacePath(args.filePath);
    const model = editor.getModel?.();

    this.ensureRegistered(monaco);
    this.ensureEditorActions(monaco, editor, onNavigateToLocation);

    const trackedDocument = this.trackedDocuments.get(filePath) ?? {
      refCount: 0,
      text,
      pendingText: null,
      pendingTimer: null,
      models: new Set<any>(),
    };
    trackedDocument.refCount += 1;
    trackedDocument.text = text;
    if (model) {
      trackedDocument.models.add(model);
    }
    this.trackedDocuments.set(filePath, trackedDocument);

    if (model) {
      this.modelFilePaths.set(model, filePath);
    }

    void api.openDocument(filePath, 'systemverilog', text).catch((error) => {
      this.handleError(error);
    });
    this.applyDiagnostics(monaco, filePath);

    return () => {
      const currentTrackedDocument = this.trackedDocuments.get(filePath);
      if (!currentTrackedDocument) {
        return;
      }

      currentTrackedDocument.refCount = Math.max(currentTrackedDocument.refCount - 1, 0);
      currentTrackedDocument.models.delete(model);
      if (model) {
        this.modelFilePaths.delete(model);
      }
      this.clearModelDiagnostics(monaco, model);

      if (currentTrackedDocument.refCount > 0) {
        return;
      }

      if (currentTrackedDocument.pendingTimer) {
        clearTimeout(currentTrackedDocument.pendingTimer);
      }

      this.trackedDocuments.delete(filePath);
      void api.closeDocument(filePath).catch((error) => {
        this.handleError(error);
      });
    };
  }

  updateDocument(filePath: string, text: string) {
    const trackedDocument = this.trackedDocuments.get(normalizeWorkspacePath(filePath));
    if (!trackedDocument || trackedDocument.text === text) {
      return;
    }

    trackedDocument.pendingText = text;
    this.scheduleChange(normalizeWorkspacePath(filePath));
  }
}

export const systemVerilogLspBridge = new SystemVerilogLspBridge();