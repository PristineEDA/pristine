import { createRef, useLayoutEffect } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getEditorFontFamilyStack } from '../../../editor/editorSettings';

const mockedUseRegisterEditorLanguages = vi.fn();
const mockedRegisterEditorThemes = vi.fn();
const mockedGetEditorLanguage = vi.fn((filePath: string) => (filePath.endsWith('.sv') ? 'systemverilog' : 'verilog'));
const mockedEnsureLspRegistered = vi.fn();
const mockedAttachLspDocument = vi.fn((_args?: unknown) => vi.fn());
const mockedUpdateLspDocument = vi.fn();
const mockedSetNavigateHandler = vi.fn();
let mockedEditorCursorBlinking = 'smooth';
let mockedEditorBracketPairGuides = true;
let mockedEditorFontFamily = 'jetbrains-mono';
let mockedEditorFontLigatures = true;
let mockedEditorFontSize = 13;
let mockedEditorFoldingStrategy = 'indentation';
let mockedEditorGlyphMargin = true;
let mockedEditorIndentGuides = true;
let mockedEditorLineNumbers = 'on';
let mockedEditorMinimapEnabled = true;
let mockedEditorRenderControlCharacters = false;
let mockedEditorRenderWhitespace = 'selection';
let mockedEditorScrollBeyondLastLine = false;
let mockedEditorSmoothScrolling = true;
let mockedEditorTabSize = 4;
let mockedEditorTheme = 'dracula';
let mockedEditorWordWrap = 'off';

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

vi.mock('../../../editor/configureMonacoLoader', () => ({}));

vi.mock('../../../editor/monacoThemes', () => ({
  registerEditorThemes: (monaco: unknown) => mockedRegisterEditorThemes(monaco),
}));

vi.mock('../../../editor/registerLanguages', () => ({
  useRegisterEditorLanguages: (monaco: unknown) => mockedUseRegisterEditorLanguages(monaco),
}));

vi.mock('../../../context/EditorSettingsContext', () => ({
  useEditorSettings: () => ({
    cursorBlinking: mockedEditorCursorBlinking,
    bracketPairGuides: mockedEditorBracketPairGuides,
    fontFamilies: [],
    fontFamily: mockedEditorFontFamily,
    fontLigatures: mockedEditorFontLigatures,
    fontSize: mockedEditorFontSize,
    foldingStrategy: mockedEditorFoldingStrategy,
    glyphMargin: mockedEditorGlyphMargin,
    indentGuides: mockedEditorIndentGuides,
    lineNumbers: mockedEditorLineNumbers,
    minimapEnabled: mockedEditorMinimapEnabled,
    renderControlCharacters: mockedEditorRenderControlCharacters,
    renderWhitespace: mockedEditorRenderWhitespace,
    scrollBeyondLastLine: mockedEditorScrollBeyondLastLine,
    smoothScrolling: mockedEditorSmoothScrolling,
    tabSize: mockedEditorTabSize,
    setCursorBlinking: vi.fn(),
    setBracketPairGuides: vi.fn(),
    setFontFamily: vi.fn(),
    setFontLigatures: vi.fn(),
    setFontSize: vi.fn(),
    setFoldingStrategy: vi.fn(),
    setGlyphMargin: vi.fn(),
    setIndentGuides: vi.fn(),
    setLineNumbers: vi.fn(),
    setMinimapEnabled: vi.fn(),
    setRenderControlCharacters: vi.fn(),
    setRenderWhitespace: vi.fn(),
    setScrollBeyondLastLine: vi.fn(),
    setSmoothScrolling: vi.fn(),
    setTabSize: vi.fn(),
    setTheme: vi.fn(),
    setWordWrap: vi.fn(),
    theme: mockedEditorTheme,
    themes: [],
    wordWrap: mockedEditorWordWrap,
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
    mockedEditorCursorBlinking = 'smooth';
    mockedEditorBracketPairGuides = true;
    mockedEditorFontFamily = 'jetbrains-mono';
    mockedEditorFontLigatures = true;
    mockedEditorFontSize = 13;
    mockedEditorFoldingStrategy = 'indentation';
    mockedEditorGlyphMargin = true;
    mockedEditorIndentGuides = true;
    mockedEditorLineNumbers = 'on';
    mockedEditorMinimapEnabled = true;
    mockedEditorRenderControlCharacters = false;
    mockedEditorRenderWhitespace = 'selection';
    mockedEditorScrollBeyondLastLine = false;
    mockedEditorSmoothScrolling = true;
    mockedEditorTabSize = 4;
    mockedEditorTheme = 'dracula';
    mockedEditorWordWrap = 'off';
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
    expect(lastEditorProps.options.fontLigatures).toBe(true);
    expect(lastEditorProps.options.fontSize).toBe(13);
    expect(lastEditorProps.options.foldingStrategy).toBe('indentation');
    expect(lastEditorProps.options.glyphMargin).toBe(true);
    expect(lastEditorProps.options.guides).toEqual({ bracketPairs: true, indentation: true });
    expect(lastEditorProps.options.lineNumbers).toBe('on');
    expect(lastEditorProps.options.minimap).toEqual({ enabled: true, scale: 1, showSlider: 'mouseover' });
    expect(lastEditorProps.options.renderControlCharacters).toBe(false);
    expect(lastEditorProps.options.renderWhitespace).toBe('selection');
    expect(lastEditorProps.options.scrollBeyondLastLine).toBe(false);
    expect(lastEditorProps.options.smoothScrolling).toBe(true);
    expect(lastEditorProps.options.tabSize).toBe(4);
    expect(lastEditorProps.keepCurrentModel).toBe(true);
    expect(lastEditorProps.theme).toBe('dracula');
    expect(lastEditorProps.options.wordWrap).toBe('off');
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

  it('applies persisted editor display, font size and theme settings to Monaco', async () => {
    mockedEditorCursorBlinking = 'solid';
    mockedEditorBracketPairGuides = false;
    mockedEditorFontFamily = 'monaspace-neon';
    mockedEditorFontLigatures = false;
    mockedEditorFontSize = 18;
    mockedEditorFoldingStrategy = 'auto';
    mockedEditorGlyphMargin = false;
    mockedEditorIndentGuides = false;
    mockedEditorLineNumbers = 'relative';
    mockedEditorMinimapEnabled = false;
    mockedEditorRenderControlCharacters = true;
    mockedEditorRenderWhitespace = 'all';
    mockedEditorScrollBeyondLastLine = true;
    mockedEditorSmoothScrolling = false;
    mockedEditorTabSize = 2;
    mockedEditorTheme = 'github-dark';
    mockedEditorWordWrap = 'on';

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
    expect(lastEditorProps.options.fontLigatures).toBe(false);
    expect(lastEditorProps.options.fontSize).toBe(18);
    expect(lastEditorProps.options.foldingStrategy).toBe('auto');
    expect(lastEditorProps.options.glyphMargin).toBe(false);
    expect(lastEditorProps.options.guides).toEqual({ bracketPairs: false, indentation: false });
    expect(lastEditorProps.options.lineNumbers).toBe('relative');
    expect(lastEditorProps.options.minimap).toEqual({ enabled: false, scale: 1, showSlider: 'mouseover' });
    expect(lastEditorProps.options.renderControlCharacters).toBe(true);
    expect(lastEditorProps.options.renderWhitespace).toBe('all');
    expect(lastEditorProps.options.scrollBeyondLastLine).toBe(true);
    expect(lastEditorProps.options.smoothScrolling).toBe(false);
    expect(lastEditorProps.options.tabSize).toBe(2);
    expect(lastEditorProps.theme).toBe('github-dark');
    expect(lastEditorProps.options.wordWrap).toBe('on');
    expect(mockEditorInstance.updateOptions).toHaveBeenCalledWith({
      cursorBlinking: 'solid',
      fontFamily: getEditorFontFamilyStack('monaspace-neon'),
      fontLigatures: false,
      fontSize: 18,
      foldingStrategy: 'auto',
      glyphMargin: false,
      guides: {
        bracketPairs: false,
        indentation: false,
      },
      lineNumbers: 'relative',
      minimap: { enabled: false, scale: 1, showSlider: 'mouseover' },
      renderControlCharacters: true,
      renderWhitespace: 'all',
      scrollBeyondLastLine: true,
      smoothScrolling: false,
      tabSize: 2,
      wordWrap: 'on',
    });
    await waitFor(() => {
      expect(mockEditorInstance.layout).toHaveBeenCalled();
    });
    expect(mockMonaco.editor.remeasureFonts).toHaveBeenCalled();

    clientWidthSpy.mockRestore();
    clientHeightSpy.mockRestore();
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