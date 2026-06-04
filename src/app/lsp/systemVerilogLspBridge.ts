import type {
  LspCallHierarchyIncomingCall,
  LspCallHierarchyItem,
  LspCallHierarchyOutgoingCall,
  LspCodeAction,
  LspCompletionItem,
  LspCompletionResponse,
  LspDebugEvent,
  LspDiagnostic,
  LspDocumentHighlight,
  LspDocumentSymbol,
  LspHover,
  LspInlayHint,
  LspMarkedString,
  LspMarkupContent,
  LspRange,
  LspSelectionRange,
  LspTextEdit,
  LspWorkspaceEdit,
  LspWorkspaceSymbol,
  WorkspaceLocation,
} from '../../../types/systemverilog-lsp';
import { claimMonacoRegistration, resetMonacoRegistrationForTests } from '../editor/monacoRegistrationTracker';
import { normalizeWorkspacePath } from '../workspace/workspaceFiles';

const CHANGE_DEBOUNCE_MS = 120;
const DEBUG_EVENT_LIMIT = 200;
const LSP_MARKER_OWNER = 'slang-lsp';
const LSP_PROVIDER_REGISTRATION_KEY = 'systemverilog-lsp-providers';
const SYSTEMVERILOG_SEMANTIC_TOKEN_LEGEND = {
  tokenTypes: ['namespace', 'type', 'class', 'enum', 'interface', 'function', 'variable', 'parameter', 'enumMember'],
  tokenModifiers: [],
};

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

function toMonacoSymbolKind(monaco: any, kind?: number) {
  switch (kind) {
    case 2:
      return monaco.languages.SymbolKind.Module;
    case 3:
      return monaco.languages.SymbolKind.Namespace;
    case 4:
      return monaco.languages.SymbolKind.Package;
    case 5:
      return monaco.languages.SymbolKind.Class;
    case 6:
      return monaco.languages.SymbolKind.Method;
    case 7:
      return monaco.languages.SymbolKind.Property;
    case 8:
      return monaco.languages.SymbolKind.Field;
    case 9:
      return monaco.languages.SymbolKind.Constructor;
    case 10:
      return monaco.languages.SymbolKind.Enum;
    case 11:
      return monaco.languages.SymbolKind.Interface;
    case 12:
      return monaco.languages.SymbolKind.Function;
    case 13:
      return monaco.languages.SymbolKind.Variable;
    case 14:
      return monaco.languages.SymbolKind.Constant;
    case 15:
      return monaco.languages.SymbolKind.String;
    case 16:
      return monaco.languages.SymbolKind.Number;
    case 17:
      return monaco.languages.SymbolKind.Boolean;
    case 18:
      return monaco.languages.SymbolKind.Array;
    case 19:
      return monaco.languages.SymbolKind.Object;
    case 20:
      return monaco.languages.SymbolKind.Key;
    case 21:
      return monaco.languages.SymbolKind.Null;
    case 22:
      return monaco.languages.SymbolKind.EnumMember;
    case 23:
      return monaco.languages.SymbolKind.Struct;
    case 24:
      return monaco.languages.SymbolKind.Event;
    case 25:
      return monaco.languages.SymbolKind.Operator;
    case 26:
      return monaco.languages.SymbolKind.TypeParameter;
    default:
      return monaco.languages.SymbolKind.Variable;
  }
}

function toMonacoDocumentHighlightKind(monaco: any, kind?: number) {
  switch (kind) {
    case 2:
      return monaco.languages.DocumentHighlightKind.Read;
    case 3:
      return monaco.languages.DocumentHighlightKind.Write;
    default:
      return monaco.languages.DocumentHighlightKind.Text;
  }
}

function toMonacoInlayHintKind(monaco: any, kind?: number) {
  switch (kind) {
    case 1:
      return monaco.languages.InlayHintKind.Type;
    case 2:
      return monaco.languages.InlayHintKind.Parameter;
    default:
      return undefined;
  }
}

function toMonacoFoldingRangeKind(monaco: any, kind?: string) {
  switch (kind) {
    case 'comment':
      return monaco.languages.FoldingRangeKind.Comment;
    case 'imports':
      return monaco.languages.FoldingRangeKind.Imports;
    case 'region':
      return monaco.languages.FoldingRangeKind.Region;
    default:
      return undefined;
  }
}

function toMonacoTextEdit(edit: LspTextEdit) {
  return {
    range: toMonacoRange(edit.range),
    text: edit.newText,
  };
}

function toMonacoPosition(position: { line: number; character: number }) {
  return {
    lineNumber: position.line + 1,
    column: position.character + 1,
  };
}

function toLspRange(range: {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}): LspRange {
  return {
    start: {
      line: range.startLineNumber - 1,
      character: range.startColumn - 1,
    },
    end: {
      line: range.endLineNumber - 1,
      character: range.endColumn - 1,
    },
  };
}

function toMonacoLocation(monaco: any, location: WorkspaceLocation) {
  return {
    uri: monaco.Uri.parse(location.filePath),
    range: toMonacoRange(location.range),
  };
}

function toMonacoWorkspaceEdit(monaco: any, edit: LspWorkspaceEdit | null) {
  if (!edit) {
    return undefined;
  }

  const textEdits = Object.entries(edit.changes).flatMap(([filePath, entries]) => (
    entries.map((textEdit) => ({
      resource: monaco.Uri.parse(filePath),
      textEdit: toMonacoTextEdit(textEdit),
      versionId: undefined,
    }))
  ));
  const fileEdits = edit.documentChanges?.map((change) => ({
    newResource: monaco.Uri.parse(change.filePath),
    options: change.options,
  })) ?? [];
  const edits = [
    ...fileEdits,
    ...textEdits,
  ];

  return { edits };
}

function toMonacoSelectionRange(range: LspSelectionRange): any {
  const parent = range.parent ? toMonacoSelectionRange(range.parent) : undefined;
  return {
    range: toMonacoRange(range.range),
    parent,
  };
}

function toMonacoCallHierarchyItem(monaco: any, item: LspCallHierarchyItem) {
  return {
    _lspItem: item,
    name: item.name,
    kind: toMonacoSymbolKind(monaco, item.kind),
    uri: monaco.Uri.parse(item.filePath ?? item.uri),
    range: toMonacoRange(item.range),
    selectionRange: toMonacoRange(item.selectionRange),
    detail: item.detail,
  };
}

function getLspCallHierarchyItem(item: any): LspCallHierarchyItem | null {
  return item?._lspItem ?? null;
}

function toMonacoIncomingCall(monaco: any, call: LspCallHierarchyIncomingCall) {
  return {
    from: toMonacoCallHierarchyItem(monaco, call.from),
    fromRanges: call.fromRanges.map((range) => toMonacoRange(range)),
  };
}

function toMonacoOutgoingCall(monaco: any, call: LspCallHierarchyOutgoingCall) {
  return {
    to: toMonacoCallHierarchyItem(monaco, call.to),
    fromRanges: call.fromRanges.map((range) => toMonacoRange(range)),
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

function cloneDiagnostic(diagnostic: LspDiagnostic): LspDiagnostic {
  return {
    ...diagnostic,
    range: {
      start: { ...diagnostic.range.start },
      end: { ...diagnostic.range.end },
    },
  };
}

class SystemVerilogLspBridge {
  private diagnosticsByFile = new Map<string, LspDiagnostic[]>();

  private diagnosticsSnapshot: ReadonlyMap<string, readonly LspDiagnostic[]> = new Map();

  private debugEvents: LspDebugEvent[] = [];

  private trackedDocuments = new Map<string, TrackedDocument>();

  private modelFilePaths = new WeakMap<any, string>();

  private editorNavigationHandlers = new WeakMap<any, NavigateToLocation | undefined>();

  private currentMonaco: any = null;

  private diagnosticsSubscriptionInstalled = false;

  private debugSubscriptionInstalled = false;

  private stateSubscriptionInstalled = false;

  private ensureInitializedPromise: Promise<void> | null = null;

  private diagnosticsListeners = new Set<() => void>();

  private debugListeners = new Set<() => void>();

  private loggedErrorMessage: string | null = null;

  private notifyDebugListeners() {
    this.debugListeners.forEach((listener) => {
      listener();
    });
  }

  private appendDebugEvent(event: LspDebugEvent) {
    this.appendDebugEvents([event]);
  }

  private appendDebugEvents(events: LspDebugEvent[]) {
    if (events.length === 0) {
      return;
    }

    const eventsBySequence = new Map<number, LspDebugEvent>();
    for (const event of this.debugEvents) {
      eventsBySequence.set(event.sequence, event);
    }
    for (const event of events) {
      eventsBySequence.set(event.sequence, event);
    }

    this.debugEvents = [...eventsBySequence.values()]
      .sort((left, right) => left.sequence - right.sequence)
      .slice(-DEBUG_EVENT_LIMIT);
    this.notifyDebugListeners();
  }

  private notifyDiagnosticsListeners() {
    this.diagnosticsListeners.forEach((listener) => {
      listener();
    });
  }

  private updateDiagnostics(filePath: string, diagnostics: LspDiagnostic[]) {
    if (diagnostics.length === 0) {
      this.diagnosticsByFile.delete(filePath);
    } else {
      this.diagnosticsByFile.set(filePath, diagnostics.map((diagnostic) => cloneDiagnostic(diagnostic)));
    }

    this.diagnosticsSnapshot = new Map(this.diagnosticsByFile);
    this.notifyDiagnosticsListeners();
  }

  getDiagnosticsSnapshot(): ReadonlyMap<string, readonly LspDiagnostic[]> {
    return this.diagnosticsSnapshot;
  }

  subscribeToDiagnosticsChanges(listener: () => void) {
    this.diagnosticsListeners.add(listener);
    return () => {
      this.diagnosticsListeners.delete(listener);
    };
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

  ensureStreamSubscriptions(monaco?: any) {
    const api = getLspApi();
    if (!api) {
      return;
    }

    if (monaco) {
      this.currentMonaco = monaco;
    }

    if (!this.diagnosticsSubscriptionInstalled) {
      api.onDiagnostics((payload) => {
        const filePath = normalizeWorkspacePath(payload.filePath);
        this.updateDiagnostics(filePath, payload.diagnostics);
        if (this.currentMonaco) {
          this.applyDiagnostics(this.currentMonaco, filePath);
        }
      });
      this.diagnosticsSubscriptionInstalled = true;
    }

    if (!this.debugSubscriptionInstalled && typeof api.onDebug === 'function') {
      api.onDebug((payload) => {
        this.appendDebugEvent(payload);
      });
      this.debugSubscriptionInstalled = true;

      if (typeof api.getDebugEvents === 'function') {
        void api.getDebugEvents()
          .then((events) => {
            this.appendDebugEvents(events);
          })
          .catch((error) => {
            this.handleError(error);
          });
      }
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

  ensureInitialized() {
    const api = getLspApi();
    if (!api?.ensureInitialized) {
      return Promise.resolve();
    }

    this.ensureStreamSubscriptions(this.currentMonaco);
    if (!this.ensureInitializedPromise) {
      this.ensureInitializedPromise = api.ensureInitialized()
        .catch((error) => {
          this.ensureInitializedPromise = null;
          this.handleError(error);
          throw error;
        });
    }

    return this.ensureInitializedPromise;
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

  private async requestCompletionResolve(item: LspCompletionItem) {
    const api = getLspApi();
    if (!api?.completionResolve) {
      return item;
    }

    try {
      return await api.completionResolve(item) ?? item;
    } catch (error) {
      this.handleError(error);
      return item;
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

  private async requestTypeDefinition(filePath: string, position: { lineNumber: number; column: number }) {
    const api = getLspApi();
    if (!api?.typeDefinition) {
      return [];
    }

    try {
      return await api.typeDefinition(filePath, position.lineNumber - 1, position.column - 1);
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  private async requestImplementation(filePath: string, position: { lineNumber: number; column: number }) {
    const api = getLspApi();
    if (!api?.implementation) {
      return [];
    }

    try {
      return await api.implementation(filePath, position.lineNumber - 1, position.column - 1);
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

  private async requestDocumentHighlights(filePath: string, position: { lineNumber: number; column: number }) {
    const api = getLspApi();
    if (!api?.documentHighlights) {
      return [];
    }

    try {
      return await api.documentHighlights(filePath, position.lineNumber - 1, position.column - 1);
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  private async requestDocumentSymbols(filePath: string) {
    const api = getLspApi();
    if (!api?.documentSymbols) {
      return [];
    }

    try {
      return await api.documentSymbols(filePath);
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  private async requestDocumentLinks(filePath: string) {
    const api = getLspApi();
    if (!api?.documentLinks) {
      return [];
    }

    try {
      return await api.documentLinks(filePath);
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  private async requestInlayHints(filePath: string, range: LspRange) {
    const api = getLspApi();
    if (!api?.inlayHints) {
      return [];
    }

    try {
      return await api.inlayHints(filePath, range);
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  private async requestCodeActions(filePath: string, range: LspRange, diagnostics: LspDiagnostic[]) {
    const api = getLspApi();
    if (!api?.codeActions) {
      return [];
    }

    try {
      return await api.codeActions(filePath, range, diagnostics);
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  private async requestFoldingRanges(filePath: string) {
    const api = getLspApi();
    if (!api?.foldingRanges) {
      return [];
    }

    try {
      return await api.foldingRanges(filePath);
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  private async requestSemanticTokens(filePath: string) {
    const api = getLspApi();
    if (!api?.semanticTokensFull) {
      return { data: [] };
    }

    try {
      return await api.semanticTokensFull(filePath);
    } catch (error) {
      this.handleError(error);
      return { data: [] };
    }
  }

  private async requestSelectionRanges(filePath: string, positions: Array<{ lineNumber: number; column: number }>) {
    const api = getLspApi();
    if (!api?.selectionRanges) {
      return [];
    }

    try {
      return await api.selectionRanges(filePath, positions.map((position) => ({
        line: position.lineNumber - 1,
        character: position.column - 1,
      })));
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  private async requestSignatureHelp(filePath: string, position: { lineNumber: number; column: number }, context: any) {
    const api = getLspApi();
    if (!api?.signatureHelp) {
      return null;
    }

    try {
      return await api.signatureHelp(
        filePath,
        position.lineNumber - 1,
        position.column - 1,
        typeof context?.triggerCharacter === 'string' ? context.triggerCharacter : undefined,
        typeof context?.triggerKind === 'number' ? context.triggerKind : undefined,
        context?.isRetrigger === true,
      );
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  private async requestPrepareCallHierarchy(filePath: string, position: { lineNumber: number; column: number }) {
    const api = getLspApi();
    if (!api?.prepareCallHierarchy) {
      return [];
    }

    try {
      return await api.prepareCallHierarchy(filePath, position.lineNumber - 1, position.column - 1);
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  private async requestCallHierarchyIncoming(item: LspCallHierarchyItem) {
    const api = getLspApi();
    if (!api?.callHierarchyIncoming) {
      return [];
    }

    try {
      return await api.callHierarchyIncoming(item);
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  private async requestCallHierarchyOutgoing(item: LspCallHierarchyItem) {
    const api = getLspApi();
    if (!api?.callHierarchyOutgoing) {
      return [];
    }

    try {
      return await api.callHierarchyOutgoing(item);
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  private async requestWorkspaceSymbols(query: string) {
    const api = getLspApi();
    if (!api?.workspaceSymbols) {
      return [];
    }

    try {
      return await api.workspaceSymbols(query);
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  private async requestPrepareRename(filePath: string, position: { lineNumber: number; column: number }) {
    const api = getLspApi();
    if (!api?.prepareRename) {
      return null;
    }

    try {
      return await api.prepareRename(filePath, position.lineNumber - 1, position.column - 1);
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  private async requestRename(filePath: string, position: { lineNumber: number; column: number }, newName: string) {
    const api = getLspApi();
    if (!api?.rename) {
      return null;
    }

    try {
      return await api.rename(filePath, position.lineNumber - 1, position.column - 1, newName);
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  ensureRegistered(monaco: any) {
    const api = getLspApi();
    if (!monaco || !api) {
      return;
    }

    this.ensureStreamSubscriptions(monaco);
    if (!claimMonacoRegistration(LSP_PROVIDER_REGISTRATION_KEY, monaco)) {
      return;
    }

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
            __lspCompletionItem: item,
          };
        });

        return { suggestions };
      },
      resolveCompletionItem: async (item: any) => {
        const sourceItem = item.__lspCompletionItem as LspCompletionItem | undefined;
        if (!sourceItem) {
          return item;
        }

        const resolvedItem = await this.requestCompletionResolve(sourceItem);
        return {
          ...item,
          detail: resolvedItem.detail ?? item.detail,
          documentation: resolvedItem.documentation
            ? { value: formatHoverContents(resolvedItem.documentation) }
            : item.documentation,
          insertText: resolvedItem.insertText ?? item.insertText,
          insertTextRules: resolvedItem.insertTextFormat === 2
            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
            : item.insertTextRules,
          additionalTextEdits: resolvedItem.additionalTextEdits?.map((edit) => toMonacoTextEdit(edit)) ?? item.additionalTextEdits,
          __lspCompletionItem: resolvedItem,
        };
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
        return locations.map((location) => toMonacoLocation(monaco, location));
      },
    });

    monaco.languages.registerReferenceProvider('systemverilog', {
      provideReferences: async (model: any, position: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return [];
        }

        const locations = await this.requestReferences(filePath, position);
        return locations.map((location) => toMonacoLocation(monaco, location));
      },
    });

    monaco.languages.registerTypeDefinitionProvider?.('systemverilog', {
      provideTypeDefinition: async (model: any, position: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return [];
        }

        const locations = await this.requestTypeDefinition(filePath, position);
        return locations.map((location) => toMonacoLocation(monaco, location));
      },
    });

    monaco.languages.registerImplementationProvider?.('systemverilog', {
      provideImplementation: async (model: any, position: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return [];
        }

        const locations = await this.requestImplementation(filePath, position);
        return locations.map((location) => toMonacoLocation(monaco, location));
      },
    });

    monaco.languages.registerDocumentHighlightProvider?.('systemverilog', {
      provideDocumentHighlights: async (model: any, position: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return [];
        }

        const highlights = await this.requestDocumentHighlights(filePath, position);
        return highlights.map((highlight: LspDocumentHighlight) => ({
          range: toMonacoRange(highlight.range),
          kind: toMonacoDocumentHighlightKind(monaco, highlight.kind),
        }));
      },
    });

    monaco.languages.registerDocumentSymbolProvider?.('systemverilog', {
      provideDocumentSymbols: async (model: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return [];
        }

        const toSymbol = (symbol: LspDocumentSymbol): any => ({
          name: symbol.name,
          detail: symbol.detail,
          kind: toMonacoSymbolKind(monaco, symbol.kind),
          range: toMonacoRange(symbol.range),
          selectionRange: toMonacoRange(symbol.selectionRange),
          children: symbol.children?.map(toSymbol) ?? [],
        });

        const symbols = await this.requestDocumentSymbols(filePath);
        return symbols.map(toSymbol);
      },
    });

    monaco.languages.registerLinkProvider?.('systemverilog', {
      provideLinks: async (model: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return { links: [] };
        }

        const links = await this.requestDocumentLinks(filePath);
        return {
          links: links.map((link) => ({
            range: toMonacoRange(link.range),
            url: link.target,
            tooltip: link.tooltip,
          })),
        };
      },
    });

    monaco.languages.registerInlayHintsProvider?.('systemverilog', {
      provideInlayHints: async (model: any, range: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return { hints: [], dispose: () => undefined };
        }

        const hints = await this.requestInlayHints(filePath, toLspRange(range));
        return {
          hints: hints.map((hint: LspInlayHint) => ({
            position: toMonacoPosition(hint.position),
            label: hint.label,
            kind: toMonacoInlayHintKind(monaco, hint.kind),
            tooltip: typeof hint.tooltip === 'string'
              ? hint.tooltip
              : hint.tooltip?.value,
            textEdits: hint.textEdits?.map((edit) => toMonacoTextEdit(edit)),
          })),
          dispose: () => undefined,
        };
      },
    });

    monaco.languages.registerCodeActionProvider?.('systemverilog', {
      provideCodeActions: async (model: any, range: any, context: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return { actions: [], dispose: () => undefined };
        }

        const actions = await this.requestCodeActions(filePath, toLspRange(range), context?.markers ?? []);
        return {
          actions: actions.map((action: LspCodeAction) => ({
            title: action.title,
            kind: action.kind,
            diagnostics: action.diagnostics,
            edit: toMonacoWorkspaceEdit(monaco, action.edit ?? null),
            isPreferred: action.isPreferred,
          })),
          dispose: () => undefined,
        };
      },
    });

    monaco.languages.registerFoldingRangeProvider?.('systemverilog', {
      provideFoldingRanges: async (model: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return [];
        }

        const ranges = await this.requestFoldingRanges(filePath);
        return ranges.map((range) => ({
          start: range.startLine + 1,
          startColumn: typeof range.startCharacter === 'number' ? range.startCharacter + 1 : undefined,
          end: range.endLine + 1,
          endColumn: typeof range.endCharacter === 'number' ? range.endCharacter + 1 : undefined,
          kind: toMonacoFoldingRangeKind(monaco, range.kind),
        }));
      },
    });

    monaco.languages.registerDocumentSemanticTokensProvider?.('systemverilog', {
      getLegend: () => SYSTEMVERILOG_SEMANTIC_TOKEN_LEGEND,
      provideDocumentSemanticTokens: async (model: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return { data: new Uint32Array() };
        }

        const tokens = await this.requestSemanticTokens(filePath);
        return {
          resultId: tokens.resultId,
          data: Uint32Array.from(tokens.data),
        };
      },
      releaseDocumentSemanticTokens: () => undefined,
    });

    monaco.languages.registerSelectionRangeProvider?.('systemverilog', {
      provideSelectionRanges: async (model: any, positions: any[]) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return [];
        }

        const ranges = await this.requestSelectionRanges(filePath, positions);
        return ranges.map((range: LspSelectionRange) => toMonacoSelectionRange(range));
      },
    });

    monaco.languages.registerSignatureHelpProvider?.('systemverilog', {
      signatureHelpTriggerCharacters: ['(', ','],
      signatureHelpRetriggerCharacters: [','],
      provideSignatureHelp: async (model: any, position: any, _token: any, context: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return null;
        }

        const signatureHelp = await this.requestSignatureHelp(filePath, position, context);
        if (!signatureHelp) {
          return null;
        }

        return {
          value: {
            signatures: signatureHelp.signatures.map((signature) => ({
              label: signature.label,
              documentation: signature.documentation
                ? { value: formatHoverContents(signature.documentation) }
                : undefined,
              parameters: signature.parameters?.map((parameter) => ({
                label: parameter.label,
                documentation: parameter.documentation
                  ? { value: formatHoverContents(parameter.documentation) }
                  : undefined,
              })) ?? [],
            })),
            activeSignature: signatureHelp.activeSignature ?? 0,
            activeParameter: signatureHelp.activeParameter ?? 0,
          },
          dispose: () => undefined,
        };
      },
    });

    monaco.languages.registerCallHierarchyProvider?.('systemverilog', {
      prepareCallHierarchy: async (model: any, position: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return [];
        }

        const items = await this.requestPrepareCallHierarchy(filePath, position);
        return items.map((item) => toMonacoCallHierarchyItem(monaco, item));
      },
      provideCallHierarchyIncomingCalls: async (item: any) => {
        const lspItem = getLspCallHierarchyItem(item);
        if (!lspItem) {
          return [];
        }

        const calls = await this.requestCallHierarchyIncoming(lspItem);
        return calls.map((call) => toMonacoIncomingCall(monaco, call));
      },
      provideCallHierarchyOutgoingCalls: async (item: any) => {
        const lspItem = getLspCallHierarchyItem(item);
        if (!lspItem) {
          return [];
        }

        const calls = await this.requestCallHierarchyOutgoing(lspItem);
        return calls.map((call) => toMonacoOutgoingCall(monaco, call));
      },
    });

    monaco.languages.registerWorkspaceSymbolProvider?.({
      provideWorkspaceSymbols: async (query: string) => {
        const symbols = await this.requestWorkspaceSymbols(query);
        return symbols.map((symbol: LspWorkspaceSymbol) => ({
          name: symbol.name,
          kind: toMonacoSymbolKind(monaco, symbol.kind),
          containerName: symbol.containerName,
          location: toMonacoLocation(monaco, symbol.location),
        }));
      },
      resolveWorkspaceSymbol: async (symbol: any) => symbol,
    });

    monaco.languages.registerRenameProvider?.('systemverilog', {
      provideRenameEdits: async (model: any, position: any, newName: string) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return null;
        }

        const edit = await this.requestRename(filePath, position, newName);
        return toMonacoWorkspaceEdit(monaco, edit) ?? null;
      },
      resolveRenameLocation: async (model: any, position: any) => {
        const filePath = getModelPath(model, this.modelFilePaths);
        if (!filePath) {
          return null;
        }

        const result = await this.requestPrepareRename(filePath, position);
        if (!result) {
          return null;
        }

        return {
          range: toMonacoRange(result.range),
          text: result.placeholder,
        };
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

export function resetSystemVerilogLspProviderRegistrationForTests(): void {
  resetMonacoRegistrationForTests(LSP_PROVIDER_REGISTRATION_KEY);
}

export const systemVerilogLspBridge = new SystemVerilogLspBridge();
