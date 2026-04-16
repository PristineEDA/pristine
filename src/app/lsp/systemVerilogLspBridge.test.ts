import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type DiagnosticsHandler = (payload: { filePath: string; diagnostics: Array<Record<string, unknown>> }) => void;
type DebugHandler = (payload: { sequence: number; timestamp: string; kind: string; direction: string; method?: string }) => void;
type StateHandler = (payload: { status: string; message?: string }) => void;

function createMonacoMock() {
  const completionProviders: any[] = [];
  const hoverProviders: any[] = [];
  const definitionProviders: any[] = [];
  const referenceProviders: any[] = [];

  const monaco = {
    MarkerSeverity: {
      Error: 'error',
      Warning: 'warning',
      Info: 'info',
      Hint: 'hint',
    },
    KeyCode: {
      F12: 123,
    },
    Uri: {
      parse: vi.fn((value: string) => ({ path: value })),
    },
    languages: {
      CompletionItemKind: {
        Text: 'text',
        Method: 'method',
        Function: 'function',
        Constructor: 'constructor',
        Field: 'field',
        Variable: 'variable',
        Class: 'class',
        Interface: 'interface',
        Module: 'module',
        Property: 'property',
        Unit: 'unit',
        Value: 'value',
        Enum: 'enum',
        Keyword: 'keyword',
        Snippet: 'snippet',
        Color: 'color',
        File: 'file',
        Reference: 'reference',
        Folder: 'folder',
        EnumMember: 'enum-member',
        Constant: 'constant',
        Struct: 'struct',
        Event: 'event',
        Operator: 'operator',
        TypeParameter: 'type-parameter',
      },
      CompletionItemInsertTextRule: {
        InsertAsSnippet: 'snippet',
      },
      registerCompletionItemProvider: vi.fn((_languageId: string, provider: any) => {
        completionProviders.push(provider);
        return { dispose: vi.fn() };
      }),
      registerHoverProvider: vi.fn((_languageId: string, provider: any) => {
        hoverProviders.push(provider);
        return { dispose: vi.fn() };
      }),
      registerDefinitionProvider: vi.fn((_languageId: string, provider: any) => {
        definitionProviders.push(provider);
        return { dispose: vi.fn() };
      }),
      registerReferenceProvider: vi.fn((_languageId: string, provider: any) => {
        referenceProviders.push(provider);
        return { dispose: vi.fn() };
      }),
    },
    editor: {
      setModelMarkers: vi.fn(),
    },
    __providers: {
      completionProviders,
      hoverProviders,
      definitionProviders,
      referenceProviders,
    },
  };

  return monaco;
}

function createModelMock(path = 'rtl/core/cpu_top.sv') {
  return {
    uri: { path },
    getWordUntilPosition: vi.fn(() => ({
      startColumn: 3,
      endColumn: 11,
    })),
  };
}

function createEditorMock(model: any, position = { lineNumber: 4, column: 6 }) {
  const actions: any[] = [];

  return {
    getModel: vi.fn(() => model),
    getPosition: vi.fn(() => position),
    addAction: vi.fn((action: any) => {
      actions.push(action);
      return { dispose: vi.fn() };
    }),
    __actions: actions,
  };
}

async function loadBridgeModule() {
  vi.resetModules();
  return import('./systemVerilogLspBridge');
}

describe('systemVerilogLspBridge', () => {
  let debugHandler: DebugHandler | undefined;
  let diagnosticsHandler: DiagnosticsHandler | undefined;
  let stateHandler: StateHandler | undefined;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugHandler = undefined;
    diagnosticsHandler = undefined;
    stateHandler = undefined;
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const electronApi = window.electronAPI as any;
    electronApi.lsp.openDocument.mockResolvedValue(undefined);
    electronApi.lsp.changeDocument.mockResolvedValue(undefined);
    electronApi.lsp.closeDocument.mockResolvedValue(undefined);
    electronApi.lsp.completion.mockResolvedValue(null);
    electronApi.lsp.hover.mockResolvedValue(null);
    electronApi.lsp.definition.mockResolvedValue([]);
    electronApi.lsp.references.mockResolvedValue([]);
    electronApi.lsp.onDebug = vi.fn((callback: DebugHandler) => {
      debugHandler = callback;
      return vi.fn();
    });
    electronApi.lsp.onDiagnostics = vi.fn((callback: DiagnosticsHandler) => {
      diagnosticsHandler = callback;
      return vi.fn();
    });
    electronApi.lsp.onState = vi.fn((callback: StateHandler) => {
      stateHandler = callback;
      return vi.fn();
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleErrorSpy.mockRestore();
  });

  it('registers providers once and translates LSP provider responses', async () => {
    const electronApi = window.electronAPI as any;
    electronApi.lsp.completion.mockResolvedValue({
      items: [
        {
          label: 'data_ready',
          kind: 6,
          detail: 'logic',
          documentation: 'Signal declaration',
          insertTextFormat: 2,
        },
      ],
    });
    electronApi.lsp.hover.mockResolvedValue({
      contents: 'Signal declaration',
      range: {
        start: { line: 3, character: 2 },
        end: { line: 3, character: 12 },
      },
    });
    electronApi.lsp.definition.mockResolvedValue([
      {
        filePath: 'rtl/core/alu.sv',
        range: {
          start: { line: 0, character: 7 },
          end: { line: 0, character: 10 },
        },
      },
    ]);
    electronApi.lsp.references.mockResolvedValue([
      {
        filePath: 'rtl/core/cpu_top.sv',
        range: {
          start: { line: 1, character: 8 },
          end: { line: 1, character: 18 },
        },
      },
    ]);

    const { systemVerilogLspBridge } = await loadBridgeModule();
    const monaco = createMonacoMock();
    const model = createModelMock();
    const editor = createEditorMock(model);

    systemVerilogLspBridge.ensureRegistered(monaco);
    systemVerilogLspBridge.ensureRegistered(monaco);
    systemVerilogLspBridge.attachDocument({
      monaco,
      editor,
      filePath: 'rtl/core/cpu_top.sv',
      text: 'module cpu_top; endmodule',
    });

    expect(electronApi.lsp.onDiagnostics).toHaveBeenCalledTimes(1);
    expect(electronApi.lsp.onDebug).toHaveBeenCalledTimes(1);
    expect(electronApi.lsp.onState).toHaveBeenCalledTimes(1);
    expect(monaco.languages.registerCompletionItemProvider).toHaveBeenCalledTimes(1);
    expect(monaco.languages.registerHoverProvider).toHaveBeenCalledTimes(1);
    expect(monaco.languages.registerDefinitionProvider).toHaveBeenCalledTimes(1);
    expect(monaco.languages.registerReferenceProvider).toHaveBeenCalledTimes(1);

    const completionResult = await monaco.__providers.completionProviders[0].provideCompletionItems(
      model,
      { lineNumber: 5, column: 10 },
      { triggerCharacter: '.', triggerKind: 2 },
    );
    expect(electronApi.lsp.completion).toHaveBeenCalledWith('rtl/core/cpu_top.sv', 4, 9, '.', 2);
    expect(completionResult).toEqual({
      suggestions: [
        expect.objectContaining({
          label: 'data_ready',
          kind: 'variable',
          detail: 'logic',
          insertText: 'data_ready',
          insertTextRules: 'snippet',
        }),
      ],
    });

    const hoverResult = await monaco.__providers.hoverProviders[0].provideHover(model, { lineNumber: 4, column: 5 });
    expect(electronApi.lsp.hover).toHaveBeenCalledWith('rtl/core/cpu_top.sv', 3, 4);
    expect(hoverResult).toEqual({
      range: {
        startLineNumber: 4,
        startColumn: 3,
        endLineNumber: 4,
        endColumn: 13,
      },
      contents: [{ value: 'Signal declaration' }],
    });

    const definitionResult = await monaco.__providers.definitionProviders[0].provideDefinition(model, { lineNumber: 4, column: 5 });
    expect(electronApi.lsp.definition).toHaveBeenCalledWith('rtl/core/cpu_top.sv', 3, 4);
    expect(monaco.Uri.parse).toHaveBeenCalledWith('rtl/core/alu.sv');
    expect(definitionResult).toEqual([
      {
        uri: { path: 'rtl/core/alu.sv' },
        range: {
          startLineNumber: 1,
          startColumn: 8,
          endLineNumber: 1,
          endColumn: 11,
        },
      },
    ]);

    const referencesResult = await monaco.__providers.referenceProviders[0].provideReferences(model, { lineNumber: 2, column: 9 });
    expect(electronApi.lsp.references).toHaveBeenCalledWith('rtl/core/cpu_top.sv', 1, 8, true);
    expect(referencesResult).toEqual([
      {
        uri: { path: 'rtl/core/cpu_top.sv' },
        range: {
          startLineNumber: 2,
          startColumn: 9,
          endLineNumber: 2,
          endColumn: 19,
        },
      },
    ]);
  });

  it('debounces change notifications and only closes after the last attached editor detaches', async () => {
    vi.useFakeTimers();
    const electronApi = window.electronAPI as any;
    const { systemVerilogLspBridge } = await loadBridgeModule();
    const monaco = createMonacoMock();
    const firstModel = createModelMock();
    const secondModel = createModelMock();
    const firstEditor = createEditorMock(firstModel);
    const secondEditor = createEditorMock(secondModel);

    const disposeFirst = systemVerilogLspBridge.attachDocument({
      monaco,
      editor: firstEditor,
      filePath: 'rtl/core/cpu_top.sv',
      text: 'module cpu_top; endmodule',
    });
    const disposeSecond = systemVerilogLspBridge.attachDocument({
      monaco,
      editor: secondEditor,
      filePath: 'rtl/core/cpu_top.sv',
      text: 'module cpu_top; endmodule',
    });

    expect(electronApi.lsp.openDocument).toHaveBeenCalledTimes(2);

    systemVerilogLspBridge.updateDocument('rtl/core/cpu_top.sv', 'module cpu_top; logic valid; endmodule');
    vi.advanceTimersByTime(119);
    expect(electronApi.lsp.changeDocument).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    await Promise.resolve();
    expect(electronApi.lsp.changeDocument).toHaveBeenCalledTimes(1);
    expect(electronApi.lsp.changeDocument).toHaveBeenCalledWith(
      'rtl/core/cpu_top.sv',
      'module cpu_top; logic valid; endmodule',
    );

    disposeFirst();
    expect(electronApi.lsp.closeDocument).not.toHaveBeenCalled();

    disposeSecond();
    expect(electronApi.lsp.closeDocument).toHaveBeenCalledTimes(1);
    expect(electronApi.lsp.closeDocument).toHaveBeenCalledWith('rtl/core/cpu_top.sv');
  });

  it('applies diagnostics to all attached models and uses F12 actions for navigation', async () => {
    const electronApi = window.electronAPI as any;
    electronApi.lsp.definition.mockResolvedValue([
      {
        filePath: 'rtl/core/alu.sv',
        range: {
          start: { line: 2, character: 4 },
          end: { line: 2, character: 7 },
        },
      },
    ]);

    const { systemVerilogLspBridge } = await loadBridgeModule();
    const monaco = createMonacoMock();
    const firstModel = createModelMock();
    const secondModel = createModelMock();
    const firstEditor = createEditorMock(firstModel);
    const secondEditor = createEditorMock(secondModel);
    const navigateToLocation = vi.fn();

    systemVerilogLspBridge.attachDocument({
      monaco,
      editor: firstEditor,
      filePath: 'rtl/core/cpu_top.sv',
      text: 'module cpu_top; endmodule',
      onNavigateToLocation: navigateToLocation,
    });
    systemVerilogLspBridge.attachDocument({
      monaco,
      editor: secondEditor,
      filePath: 'rtl/core/cpu_top.sv',
      text: 'module cpu_top; endmodule',
    });

    expect(diagnosticsHandler).toBeTypeOf('function');
    diagnosticsHandler?.({
      filePath: 'rtl/core/cpu_top.sv',
      diagnostics: [
        {
          message: 'Undriven signal',
          severity: 1,
          range: {
            start: { line: 3, character: 4 },
            end: { line: 3, character: 14 },
          },
        },
      ],
    });

    const markerCalls = (monaco.editor.setModelMarkers as ReturnType<typeof vi.fn>).mock.calls
      .filter((call) => call[1] === 'slang-lsp' && Array.isArray(call[2]) && call[2].length === 1);
    expect(markerCalls).toHaveLength(2);
    expect(markerCalls[0]?.[0]).toBe(firstModel);
    expect(markerCalls[1]?.[0]).toBe(secondModel);
    expect(markerCalls[0]?.[2]?.[0]).toEqual(expect.objectContaining({
      severity: 'error',
      message: 'Undriven signal',
      startLineNumber: 4,
      startColumn: 5,
      endLineNumber: 4,
      endColumn: 15,
    }));

    await firstEditor.__actions[0].run(firstEditor);
    expect(electronApi.lsp.definition).toHaveBeenCalledWith('rtl/core/cpu_top.sv', 3, 5);
    expect(navigateToLocation).toHaveBeenCalledWith('rtl/core/alu.sv', 3, 5);

    expect(stateHandler).toBeTypeOf('function');
    stateHandler?.({ status: 'error', message: 'language server failed' });
    stateHandler?.({ status: 'error', message: 'language server failed' });
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('language server failed');
  });

  it('buffers debug events and notifies listeners with the latest bounded snapshot', async () => {
    const { systemVerilogLspBridge } = await loadBridgeModule();
    const monaco = createMonacoMock();

    systemVerilogLspBridge.ensureRegistered(monaco);

    const listener = vi.fn();
    const unsubscribe = systemVerilogLspBridge.subscribeToDebugEvents(listener);

    for (let index = 1; index <= 205; index += 1) {
      debugHandler?.({
        sequence: index,
        timestamp: `2026-01-01T00:00:${String(index).padStart(2, '0')}.000Z`,
        direction: 'client->server',
        kind: 'request',
        method: `method-${index}`,
      });
    }

    expect(listener).toHaveBeenCalledTimes(205);

    const snapshot = systemVerilogLspBridge.getDebugEvents();
    expect(snapshot).toHaveLength(200);
    expect(snapshot[0]).toEqual(expect.objectContaining({ sequence: 6, method: 'method-6' }));
    expect(snapshot[snapshot.length - 1]).toEqual(expect.objectContaining({ sequence: 205, method: 'method-205' }));

    unsubscribe();
  });
});