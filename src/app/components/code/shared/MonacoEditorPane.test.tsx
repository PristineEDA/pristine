import { createRef, useLayoutEffect } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Problem } from '../../../../data/mockData';
import { getEditorFontFamilyStack } from '../../../editor/editorSettings';

const mockedUseRegisterEditorLanguages = vi.fn();
const mockedRegisterEditorThemes = vi.fn();
const mockedGetEditorLanguage = vi.fn((filePath: string) => (filePath.endsWith('.sv') ? 'systemverilog' : 'verilog'));
const mockedEnsureLspRegistered = vi.fn();
const mockedAttachLspDocument = vi.fn((_args?: unknown) => vi.fn());
const mockedUpdateLspDocument = vi.fn();
const mockedSetNavigateHandler = vi.fn();
let mockedProblems: Problem[] = [];
let mockedEditorFontFamily = 'jetbrains-mono';
let mockedEditorFontSize = 13;
let mockedEditorTheme = 'dracula';

const {
  mockCursorPositionListeners,
  mockEditorCommands,
  mockEditorComponent,
  mockEditorDomNode,
  mockEditorInstance,
  mockFocusEditorTextListeners,
  mockModels,
  mockMonaco,
} = vi.hoisted(() => {
  const activeElement = {};
  const cursorPositionListeners: Array<(event: { position: { lineNumber: number; column: number } }) => void> = [];
  const editorCommands: Array<{ keybinding: number; handler: () => void }> = [];
  const focusEditorTextListeners: Array<() => void> = [];
  const editorDomNode = {
    contains: vi.fn((element: unknown) => element === activeElement),
    ownerDocument: {
      activeElement,
    },
  };
  const editorInstance = {
    getDomNode: vi.fn(() => editorDomNode),
    hasTextFocus: vi.fn(() => true),
    onDidChangeCursorPosition: vi.fn((callback: (event: { position: { lineNumber: number; column: number } }) => void) => {
      cursorPositionListeners.push(callback);
      return { dispose: vi.fn() };
    }),
    onDidFocusEditorText: vi.fn((callback: () => void) => {
      focusEditorTextListeners.push(callback);
      return { dispose: vi.fn() };
    }),
    addCommand: vi.fn((keybinding: number, handler: () => void) => {
      editorCommands.push({ keybinding, handler });
      return editorCommands.length;
    }),
    updateOptions: vi.fn(),
    layout: vi.fn(),
  };

  const models = [{ id: 'model-a' }, { id: 'model-b' }];
  const monaco = {
    editor: {
      getModels: vi.fn(() => models),
      remeasureFonts: vi.fn(),
      setModelMarkers: vi.fn(),
    },
    MarkerSeverity: {
      Error: 8,
      Warning: 4,
      Info: 2,
    },
    KeyCode: {
      KeyS: 49,
    },
    KeyMod: {
      CtrlCmd: 2048,
    },
  };

  return {
    mockCursorPositionListeners: cursorPositionListeners,
    mockEditorCommands: editorCommands,
    mockEditorInstance: editorInstance,
    mockEditorDomNode: editorDomNode,
    mockFocusEditorTextListeners: focusEditorTextListeners,
    mockModels: models,
    mockMonaco: monaco,
    mockEditorComponent: vi.fn(),
  };
});

vi.mock('@monaco-editor/react', () => ({
  default: (props: any) => {
    mockEditorComponent(props);

    useLayoutEffect(() => {
      props.beforeMount?.(mockMonaco);
      props.onMount?.(mockEditorInstance);
    }, []);

    return (
      <button
        type="button"
        data-testid="monaco-editor"
        data-language={props.language}
        onClick={() => props.onChange?.('updated code')}
      >
        {props.value}
      </button>
    );
  },
  useMonaco: () => mockMonaco,
}));

vi.mock('../../../../data/mockDataLoader', () => ({
  useProblemsList: () => mockedProblems,
}));

vi.mock('../../../editor/monacoThemes', () => ({
  registerEditorThemes: (monaco: unknown) => mockedRegisterEditorThemes(monaco),
}));

vi.mock('../../../editor/registerLanguages', () => ({
  useRegisterEditorLanguages: (monaco: unknown) => mockedUseRegisterEditorLanguages(monaco),
}));

vi.mock('../../../context/EditorSettingsContext', () => ({
  useEditorSettings: () => ({
    fontFamilies: [],
    fontFamily: mockedEditorFontFamily,
    fontSize: mockedEditorFontSize,
    setFontFamily: vi.fn(),
    setFontSize: vi.fn(),
    setTheme: vi.fn(),
    theme: mockedEditorTheme,
    themes: [],
  }),
}));

vi.mock('../../../workspace/workspaceFiles', () => ({
  getEditorLanguage: (filePath: string) => mockedGetEditorLanguage(filePath),
}));

vi.mock('../../../lsp/systemVerilogLspBridge', () => ({
  systemVerilogLspBridge: {
    ensureRegistered: (monaco: unknown) => mockedEnsureLspRegistered(monaco),
    attachDocument: (args: unknown) => mockedAttachLspDocument(args),
    updateDocument: (filePath: string, text: string) => mockedUpdateLspDocument(filePath, text),
    setNavigateHandler: (editor: unknown, handler: unknown) => mockedSetNavigateHandler(editor, handler),
  },
}));

import { MonacoEditorPane } from './MonacoEditorPane';

describe('MonacoEditorPane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (mockMonaco as any).__pristineLanguagesRegistered;
    delete (mockMonaco as any).__pristineThemesRegistered;
    mockedProblems = [];
    mockedEditorFontFamily = 'jetbrains-mono';
    mockedEditorFontSize = 13;
    mockedEditorTheme = 'dracula';
    mockedEnsureLspRegistered.mockReset();
    mockedAttachLspDocument.mockReset();
    mockedAttachLspDocument.mockImplementation(() => vi.fn());
    mockedUpdateLspDocument.mockReset();
    mockedSetNavigateHandler.mockReset();
    mockCursorPositionListeners.length = 0;
    mockEditorCommands.length = 0;
    mockFocusEditorTextListeners.length = 0;
    mockEditorDomNode.contains.mockReturnValue(true);
    mockMonaco.editor.getModels.mockReturnValue(mockModels);
    mockEditorInstance.hasTextFocus.mockReturnValue(true);
  });

  it('configures the editor and exposes mount callbacks', () => {
    const editorRef = createRef<any>();
    const onEditorMount = vi.fn();
    const onActiveModelReady = vi.fn();
    const onCursorChange = vi.fn();

    render(
      <MonacoEditorPane
        activeTabId="rtl/core/cpu_top.sv"
        code="module cpu_top; endmodule"
        editorRef={editorRef}
        onActiveModelReady={onActiveModelReady}
        onEditorMount={onEditorMount}
        onCursorChange={onCursorChange}
      />,
    );

    expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-language', 'systemverilog');
    expect(screen.getByTestId('monaco-editor')).toHaveTextContent('module cpu_top; endmodule');
    expect(mockedGetEditorLanguage).toHaveBeenCalledWith('rtl/core/cpu_top.sv');
    expect(mockedUseRegisterEditorLanguages).toHaveBeenCalledWith(mockMonaco);
    expect(mockedRegisterEditorThemes).toHaveBeenCalledWith(mockMonaco);
    expect(mockedEnsureLspRegistered).toHaveBeenCalledWith(mockMonaco);
    expect(mockedAttachLspDocument).toHaveBeenCalledWith(expect.objectContaining({
      monaco: mockMonaco,
      editor: mockEditorInstance,
      filePath: 'rtl/core/cpu_top.sv',
      text: 'module cpu_top; endmodule',
    }));
    expect(mockedSetNavigateHandler).toHaveBeenCalledWith(mockEditorInstance, undefined);
    expect(mockedUpdateLspDocument).toHaveBeenCalledWith('rtl/core/cpu_top.sv', 'module cpu_top; endmodule');
    expect(editorRef.current).toBe(mockEditorInstance);
    expect(onActiveModelReady).toHaveBeenCalledWith('rtl/core/cpu_top.sv');
    expect(onEditorMount).toHaveBeenCalledWith(mockEditorInstance);

    const cursorPositionListener = mockCursorPositionListeners[mockCursorPositionListeners.length - 1];
    cursorPositionListener?.({ position: { lineNumber: 5, column: 10 } });
    expect(onCursorChange).toHaveBeenCalledWith(5, 10);

    const editorCalls = mockEditorComponent.mock.calls;
    const lastEditorProps = editorCalls[editorCalls.length - 1]?.[0];
    expect(lastEditorProps.options.fontFamily).toBe(getEditorFontFamilyStack('jetbrains-mono'));
    expect(lastEditorProps.options.fontSize).toBe(13);
    expect(lastEditorProps.keepCurrentModel).toBe(true);
    expect(lastEditorProps.theme).toBe('dracula');
  });

  it('propagates cursor changes when the editor already has text focus after opening a file', () => {
    const onCursorChange = vi.fn();

    render(
      <MonacoEditorPane
        activeTabId="rtl/core/reg_file.v"
        code="module reg_file; endmodule"
        editorRef={createRef<any>()}
        onCursorChange={onCursorChange}
      />,
    );

    const cursorPositionListener = mockCursorPositionListeners[mockCursorPositionListeners.length - 1];
    cursorPositionListener?.({ position: { lineNumber: 2, column: 1 } });

    expect(mockFocusEditorTextListeners).toHaveLength(1);
    expect(onCursorChange).toHaveBeenCalledWith(2, 1);
    expect(mockedAttachLspDocument).not.toHaveBeenCalled();
  });

  it('applies persisted editor font family, font size and theme settings to Monaco', async () => {
    mockedEditorFontFamily = 'monaspace-neon';
    mockedEditorFontSize = 18;
    mockedEditorTheme = 'github-dark';

    const clientWidthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(960);
    const clientHeightSpy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(540);

    render(
      <MonacoEditorPane
        activeTabId="rtl/core/cpu_top.sv"
        code="module cpu_top; endmodule"
        editorRef={createRef<any>()}
      />,
    );

    const editorCalls = mockEditorComponent.mock.calls;
    const lastEditorProps = editorCalls[editorCalls.length - 1]?.[0];

    expect(lastEditorProps.options.fontFamily).toBe(getEditorFontFamilyStack('monaspace-neon'));
    expect(lastEditorProps.options.fontSize).toBe(18);
    expect(lastEditorProps.theme).toBe('github-dark');
    expect(mockEditorInstance.updateOptions).toHaveBeenCalledWith({
      fontFamily: getEditorFontFamilyStack('monaspace-neon'),
      fontSize: 18,
    });
    await waitFor(() => {
      expect(mockEditorInstance.layout).toHaveBeenCalled();
    });
    expect(mockMonaco.editor.remeasureFonts).toHaveBeenCalled();

    clientWidthSpy.mockRestore();
    clientHeightSpy.mockRestore();
  });

  it('maps matching problems to monaco markers for every model', () => {
    mockedProblems = [
      {
        id: 'error-1',
        file: 'cpu_top.sv',
        fileId: 'rtl/core/cpu_top.sv',
        line: 11,
        column: 3,
        severity: 'error',
        message: 'Undriven net detected',
        code: 'E001',
        source: 'rtl-lint',
      },
      {
        id: 'warning-1',
        file: 'cpu_top.sv',
        fileId: 'rtl/core/cpu_top.sv',
        line: 24,
        column: 7,
        severity: 'warning',
        message: 'Potential latch inferred',
        code: 'W002',
        source: 'rtl-lint',
      },
      {
        id: 'info-1',
        file: 'cpu_top.sv',
        fileId: 'rtl/core/cpu_top.sv',
        line: 30,
        column: 1,
        severity: 'info',
        message: 'Consider registering this output',
        code: 'I003',
        source: 'timing-advisor',
      },
      {
        id: 'other-file',
        file: 'alu.v',
        fileId: 'rtl/core/alu.v',
        line: 8,
        column: 1,
        severity: 'error',
        message: 'Should be filtered out',
      },
    ];

    render(
      <MonacoEditorPane
        activeTabId="rtl/core/cpu_top.sv"
        code="module cpu_top; endmodule"
        editorRef={createRef<any>()}
      />,
    );

    expect(mockMonaco.editor.setModelMarkers).toHaveBeenCalledTimes(2);

    const firstCall = mockMonaco.editor.setModelMarkers.mock.calls[0];
    expect(firstCall?.[0]).toBe(mockModels[0]);
    expect(firstCall?.[1]).toBe('rtl-lint');
    expect(firstCall?.[2]).toEqual([
      {
        severity: 8,
        startLineNumber: 11,
        startColumn: 3,
        endLineNumber: 11,
        endColumn: 33,
        message: 'Undriven net detected',
        code: 'E001',
        source: 'rtl-lint',
      },
      {
        severity: 4,
        startLineNumber: 24,
        startColumn: 7,
        endLineNumber: 24,
        endColumn: 37,
        message: 'Potential latch inferred',
        code: 'W002',
        source: 'rtl-lint',
      },
      {
        severity: 2,
        startLineNumber: 30,
        startColumn: 1,
        endLineNumber: 30,
        endColumn: 31,
        message: 'Consider registering this output',
        code: 'I003',
        source: 'timing-advisor',
      },
    ]);
  });

  it('updates content and renders the drag interaction shield when requested', () => {
    const onContentChange = vi.fn();

    render(
      <MonacoEditorPane
        activeTabId="rtl/core/alu.v"
        code="assign y = a + b;"
        editorRef={createRef<any>()}
        onContentChange={onContentChange}
        showDragInteractionShield
        dragInteractionShieldTestId="editor-drag-shield"
      />,
    );

    expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-language', 'verilog');
    expect(screen.getByTestId('editor-drag-shield')).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(screen.getByTestId('monaco-editor'));
    expect(onContentChange).toHaveBeenCalledWith('updated code');
  });

  it('registers a Monaco save command so Ctrl/Cmd+S works while the editor is focused', () => {
    const onSaveShortcut = vi.fn();

    render(
      <MonacoEditorPane
        activeTabId="rtl/core/reg_file.v"
        code="module reg_file; endmodule"
        editorRef={createRef<any>()}
        onSaveShortcut={onSaveShortcut}
      />,
    );

    expect(mockEditorInstance.addCommand).toHaveBeenCalledWith(
      mockMonaco.KeyMod.CtrlCmd | mockMonaco.KeyCode.KeyS,
      expect.any(Function),
    );

    const saveCommand = mockEditorCommands[mockEditorCommands.length - 1];
    saveCommand?.handler();

    expect(onSaveShortcut).toHaveBeenCalledTimes(1);
  });
});