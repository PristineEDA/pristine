import { createRef, useLayoutEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getEditorFontFamilyStack } from '../../../editor/editorSettings';

const mockedUseRegisterEditorLanguages = vi.fn();
const mockedRegisterBuiltInMonacoThemes = vi.fn();
const mockedDefineMonacoTheme = vi.fn();
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
let mockedEditorWordWrap = 'off';
let mockedEditorInlineGitDiffEnabled = true;
let mockedEditorInlineGitDiffStateBackgroundsEnabled = true;
let mockedWorkspaceGitIsLoading = false;
let mockedWorkspaceGitPathStates: Record<string, string> = {};

const {
  mockCursorPositionListeners,
  mockEditorCommands,
  mockEditorComponent,
  mockEditorDomNode,
  mockEditorInstance,
  mockEditorModelState,
  mockEditorMouseDownListeners,
  mockFocusEditorTextListeners,
  mockInlineGitDiffAddedZones,
  mockInlineGitDiffRemovedZones,
  mockModels,
  mockMonaco,
} = vi.hoisted(() => {
  const activeElement = {};
  const cursorPositionListeners: Array<(event: { position: { lineNumber: number; column: number } }) => void> = [];
  const editorCommands: Array<{ keybinding: number; handler: () => void }> = [];
  const focusEditorTextListeners: Array<() => void> = [];
  const editorMouseDownListeners: Array<(event: any) => void> = [];
  const inlineGitDiffAddedZones: any[] = [];
  const inlineGitDiffRemovedZones: string[] = [];
  const editorModelState = {
    path: '',
    value: '',
  };
  const editorDomNode = {
    contains: vi.fn((element: unknown) => element === activeElement),
    ownerDocument: {
      activeElement,
    },
  };
  const editorInstance = {
    applyFontInfo: vi.fn((target: any) => {
      target.style.fontFamily = '"Mock Editor Mono", monospace';
      target.style.fontSize = '17px';
      target.style.lineHeight = '24px';
    }),
    getDomNode: vi.fn(() => editorDomNode),
    getOption: vi.fn((option: number) => {
      if (option === 58) {
        return '"Mock Editor Mono", monospace';
      }

      if (option === 61) {
        return 17;
      }

      if (option === 75) {
        return 24;
      }

      return undefined;
    }),
    hasTextFocus: vi.fn(() => true),
    onDidChangeCursorPosition: vi.fn((callback: (event: { position: { lineNumber: number; column: number } }) => void) => {
      cursorPositionListeners.push(callback);
      return { dispose: vi.fn() };
    }),
    onDidFocusEditorText: vi.fn((callback: () => void) => {
      focusEditorTextListeners.push(callback);
      return { dispose: vi.fn() };
    }),
    onMouseDown: vi.fn((callback: (event: any) => void) => {
      editorMouseDownListeners.push(callback);
      return { dispose: vi.fn() };
    }),
    addCommand: vi.fn((keybinding: number, handler: () => void) => {
      editorCommands.push({ keybinding, handler });
      return editorCommands.length;
    }),
    changeViewZones: vi.fn((callback: (accessor: { addZone: (zone: any) => string; removeZone: (zoneId: string) => void }) => void) => {
      callback({
        addZone: (zone: any) => {
          inlineGitDiffAddedZones.push(zone);
          return `zone-${inlineGitDiffAddedZones.length}`;
        },
        removeZone: (zoneId: string) => {
          inlineGitDiffRemovedZones.push(zoneId);
        },
      });
    }),
    deltaDecorations: vi.fn((_oldDecorations: string[], nextDecorations: any[]) => (
      nextDecorations.map((_, index) => `decoration-${index + 1}`)
    )),
    getModel: vi.fn(() => ({
      getLineCount: vi.fn(() => Math.max(editorModelState.value.split('\n').length, 1)),
      getLineMaxColumn: vi.fn((lineNumber: number) => {
        const line = editorModelState.value.split('\n')[lineNumber - 1] ?? '';
        return line.length + 1;
      }),
      getValue: vi.fn(() => editorModelState.value),
      uri: {
        fsPath: editorModelState.path,
        path: editorModelState.path,
      },
    })),
    trigger: vi.fn(),
    updateOptions: vi.fn(),
    layout: vi.fn(),
  };

  const models = [{ id: 'model-a' }, { id: 'model-b' }];
  const monaco = {
    editor: {
      EditorOption: {
        fontFamily: 58,
        fontInfo: 59,
        fontSize: 61,
        lineHeight: 75,
      },
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
    mockEditorModelState: editorModelState,
    mockEditorMouseDownListeners: editorMouseDownListeners,
    mockFocusEditorTextListeners: focusEditorTextListeners,
    mockInlineGitDiffAddedZones: inlineGitDiffAddedZones,
    mockInlineGitDiffRemovedZones: inlineGitDiffRemovedZones,
    mockModels: models,
    mockMonaco: monaco,
    mockEditorComponent: vi.fn(),
  };
});

vi.mock('@monaco-editor/react', () => ({
  default: (props: any) => {
    mockEditorComponent(props);
    mockEditorModelState.path = props.path;
    mockEditorModelState.value = props.value;

    useLayoutEffect(() => {
      props.beforeMount?.(mockMonaco);
      props.onMount?.(mockEditorInstance);
    }, []);

    return (
      <div className="monaco-editor">
        <button
          type="button"
          data-testid="monaco-editor"
          data-language={props.language}
          className="inputarea"
          onClick={() => props.onChange?.('updated code')}
        >
          {props.value}
        </button>
      </div>
    );
  },
  useMonaco: () => mockMonaco,
}));

vi.mock('../../../editor/configureMonacoLoader', () => ({}));

vi.mock('../../../theme/monacoColorTheme', () => ({
  registerBuiltInMonacoThemes: (monaco: unknown) => mockedRegisterBuiltInMonacoThemes(monaco),
  defineMonacoTheme: (monaco: unknown, theme: unknown) => mockedDefineMonacoTheme(monaco, theme),
}));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'dark',
    themeId: 'vscode-2026-dark',
    activeTheme: {
      id: 'vscode-2026-dark',
      label: 'Dark 2026',
      description: 'Built-in VS Code 2026 dark color theme.',
      author: 'Microsoft',
      kind: 'dark',
      source: 'builtin',
      colors: {
        'editor.background': '#121314',
        'editor.foreground': '#BBBEBF',
      },
      tokenColors: [],
      semanticHighlighting: true,
      semanticTokenColors: {},
    },
    availableThemes: [],
    importedThemes: [],
    isImportingTheme: false,
    getThemePreview: vi.fn(),
    importTheme: vi.fn(),
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
  }),
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
    setInlineGitDiffEnabled: vi.fn(),
    setInlineGitDiffStateBackgroundsEnabled: vi.fn(),
    themes: [],
    inlineGitDiffEnabled: mockedEditorInlineGitDiffEnabled,
    inlineGitDiffStateBackgroundsEnabled: mockedEditorInlineGitDiffStateBackgroundsEnabled,
    wordWrap: mockedEditorWordWrap,
  }),
}));

vi.mock('../../../git/workspaceGitStatus', () => ({
  getWorkspaceGitPathState: (snapshot: { pathStates: Record<string, string> }, path: string) => snapshot.pathStates[path.replace(/\\/g, '/')],
  useWorkspaceGitStatus: () => ({
    branchName: 'dev',
    hasProjectFiles: true,
    isGitRepo: true,
    isLoading: mockedWorkspaceGitIsLoading,
    pathStates: mockedWorkspaceGitPathStates,
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
    mockedEditorWordWrap = 'off';
    mockedEditorInlineGitDiffEnabled = true;
    mockedEditorInlineGitDiffStateBackgroundsEnabled = true;
    mockedWorkspaceGitIsLoading = false;
    mockedWorkspaceGitPathStates = {};
    mockedEnsureLspRegistered.mockReset();
    mockedAttachLspDocument.mockReset();
    mockedAttachLspDocument.mockImplementation(() => vi.fn());
    mockedUpdateLspDocument.mockReset();
    mockedSetNavigateHandler.mockReset();
    mockCursorPositionListeners.length = 0;
    mockEditorCommands.length = 0;
    mockEditorMouseDownListeners.length = 0;
    mockFocusEditorTextListeners.length = 0;
    mockInlineGitDiffAddedZones.length = 0;
    mockInlineGitDiffRemovedZones.length = 0;
    mockEditorModelState.path = '';
    mockEditorModelState.value = '';
    mockEditorDomNode.contains.mockReturnValue(true);
    mockMonaco.editor.getModels.mockReturnValue(mockModels);
    mockEditorInstance.hasTextFocus.mockReturnValue(true);
    mockEditorInstance.changeViewZones.mockClear();
    mockEditorInstance.deltaDecorations.mockClear();
    mockEditorInstance.getModel.mockClear();
    mockEditorInstance.getOption.mockClear();
    mockEditorInstance.onMouseDown.mockClear();
    mockEditorInstance.applyFontInfo.mockClear();
    mockEditorInstance.trigger.mockReset();
    vi.mocked(window.electronAPI!.git.getFileDiff).mockReset();
    vi.mocked(window.electronAPI!.git.getFileDiff).mockResolvedValue({
      filePath: '',
      originalContent: '',
      currentContent: '',
    });
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
    expect(mockedRegisterBuiltInMonacoThemes).toHaveBeenCalledWith(mockMonaco);
    expect(mockedDefineMonacoTheme).toHaveBeenCalledWith(mockMonaco, expect.objectContaining({ id: 'vscode-2026-dark' }));
    expect(mockedEnsureLspRegistered).toHaveBeenCalledWith(mockMonaco);
    expect(mockedAttachLspDocument).toHaveBeenCalledWith(expect.objectContaining({
      monaco: mockMonaco,
      editor: mockEditorInstance,
      filePath: 'rtl/core/cpu_top.sv',
      text: 'module cpu_top; endmodule',
    }));
    expect(mockedSetNavigateHandler).toHaveBeenCalledWith(mockEditorInstance, expect.any(Function));
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
    expect(lastEditorProps.theme).toBe('vscode-2026-dark');
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

  it('applies persisted editor display and font size settings to Monaco while the UI theme comes from ThemeContext', async () => {
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
    expect(lastEditorProps.theme).toBe('vscode-2026-dark');
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

  it('applies resize-driven layouts immediately and skips duplicate viewport sizes', () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    const resizeObserverCallbacks: ResizeObserverCallback[] = [];
    let currentWidth = 960;
    let currentHeight = 540;

    class ResizeObserverMock {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();

      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallbacks.push(callback);
      }
    }

    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });

    const clientWidthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => currentWidth);
    const clientHeightSpy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => currentHeight);

    try {
      render(
        <MonacoEditorPane
          activeTabId="rtl/core/cpu_top.sv"
          code="module cpu_top; endmodule"
          editorRef={createRef<any>()}
        />,
      );

      const editorCalls = mockEditorComponent.mock.calls;
      const lastEditorProps = editorCalls[editorCalls.length - 1]?.[0];

      expect(lastEditorProps.options.automaticLayout).toBe(false);
      expect(resizeObserverCallbacks).toHaveLength(1);

      mockEditorInstance.layout.mockClear();
      currentWidth = 1120;

      act(() => {
        resizeObserverCallbacks[0]?.([] as ResizeObserverEntry[], {} as ResizeObserver);
      });

      expect(mockEditorInstance.layout).toHaveBeenCalledTimes(1);
      expect(mockEditorInstance.layout).toHaveBeenCalledWith({ width: 1120, height: 540 });

      act(() => {
        resizeObserverCallbacks[0]?.([] as ResizeObserverEntry[], {} as ResizeObserver);
      });

      expect(mockEditorInstance.layout).toHaveBeenCalledTimes(1);
    } finally {
      clientWidthSpy.mockRestore();
      clientHeightSpy.mockRestore();
      Object.defineProperty(globalThis, 'ResizeObserver', {
        configurable: true,
        writable: true,
        value: originalResizeObserver,
      });
    }
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

  it('renders inline git diff decorations without showing detail zones by default', async () => {
    const filePath = 'rtl/core/reg_file.v';
    const currentContent = 'module reg_file;\nassign ready = valid;\nassign changed = 1\'b1;\nendmodule';
    const onInlineGitDiffSummaryChange = vi.fn();
    mockedWorkspaceGitPathStates = { [filePath]: 'modified' };
    vi.mocked(window.electronAPI!.git.getFileDiff).mockResolvedValue({
      filePath,
      originalContent: 'module reg_file;\nassign ready = done;\nendmodule',
      currentContent,
    });

    render(
      <MonacoEditorPane
        activeTabId={filePath}
        code={currentContent}
        editorRef={createRef<any>()}
        onInlineGitDiffSummaryChange={onInlineGitDiffSummaryChange}
      />,
    );

    await waitFor(() => {
      expect(window.electronAPI?.git.getFileDiff).toHaveBeenCalledWith(filePath);
    });
    await waitFor(() => {
      expect(mockEditorInstance.deltaDecorations.mock.calls.some((call) => Array.isArray(call[1]) && call[1].length > 0)).toBe(true);
    });

    expect(mockInlineGitDiffAddedZones).toHaveLength(0);

    const decorationCalls = mockEditorInstance.deltaDecorations.mock.calls
      .filter((call) => Array.isArray(call[1]) && call[1].length > 0);
    const decorations = decorationCalls[decorationCalls.length - 1]?.[1] ?? [];

    expect(decorations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        options: expect.objectContaining({
          className: expect.stringContaining('pristine-inline-git-diff-line-modified'),
          lineNumberClassName: expect.stringContaining('pristine-inline-git-diff-line-number-modified'),
          marginClassName: expect.stringContaining('pristine-inline-git-diff-margin-modified'),
        }),
      }),
    ]));
    expect(decorations[0]?.options.linesDecorationsClassName).toBeUndefined();
    await waitFor(() => {
      expect(onInlineGitDiffSummaryChange).toHaveBeenLastCalledWith({
        addedLineCount: 2,
        filePath,
        removedLineCount: 1,
      });
    });
  });

  it('redraws inline git diff decorations without line backgrounds when state backgrounds are disabled', async () => {
    const filePath = 'rtl/core/reg_file.v';
    const currentContent = 'module reg_file;\nassign ready = valid;\nendmodule';
    mockedWorkspaceGitPathStates = { [filePath]: 'modified' };
    vi.mocked(window.electronAPI!.git.getFileDiff).mockResolvedValue({
      filePath,
      originalContent: 'module reg_file;\nassign ready = done;\nendmodule',
      currentContent,
    });
    const editorRef = createRef<any>();

    const { rerender } = render(
      <MonacoEditorPane
        activeTabId={filePath}
        code={currentContent}
        editorRef={editorRef}
      />,
    );

    await waitFor(() => {
      expect(mockEditorInstance.deltaDecorations.mock.calls.some((call) => Array.isArray(call[1]) && call[1].length > 0)).toBe(true);
    });
    expect(window.electronAPI?.git.getFileDiff).toHaveBeenCalledTimes(1);

    mockEditorInstance.deltaDecorations.mockClear();
    mockedEditorInlineGitDiffStateBackgroundsEnabled = false;

    rerender(
      <MonacoEditorPane
        activeTabId={filePath}
        code={currentContent}
        editorRef={editorRef}
      />,
    );

    await waitFor(() => {
      expect(mockEditorInstance.deltaDecorations).toHaveBeenCalled();
    });

    expect(window.electronAPI?.git.getFileDiff).toHaveBeenCalledTimes(1);

    const decorationCalls = mockEditorInstance.deltaDecorations.mock.calls
      .filter((call) => Array.isArray(call[1]) && call[1].length > 0);
    const decorations = decorationCalls[decorationCalls.length - 1]?.[1] ?? [];
    const modifiedDecoration = decorations.find((decoration: any) => decoration.options.marginClassName?.includes('pristine-inline-git-diff-margin-modified'));

    expect(modifiedDecoration?.options.marginClassName).toContain('pristine-inline-git-diff-margin-modified');
    expect(modifiedDecoration?.options.className).toBeUndefined();
    expect(modifiedDecoration?.options.lineNumberClassName).toBe('pristine-inline-git-diff-line-number-hit-target');
  });

  it('renders removed-only inline git diff decorations in the margin and line number', async () => {
    const filePath = 'rtl/core/reg_file.v';
    const currentContent = 'module reg_file;\nendmodule';
    mockedWorkspaceGitPathStates = { [filePath]: 'modified' };
    vi.mocked(window.electronAPI!.git.getFileDiff).mockResolvedValue({
      filePath,
      originalContent: 'module reg_file;\nassign removed = 1\'b1;\nendmodule',
      currentContent,
    });

    render(
      <MonacoEditorPane
        activeTabId={filePath}
        code={currentContent}
        editorRef={createRef<any>()}
      />,
    );

    await waitFor(() => {
      expect(mockEditorInstance.deltaDecorations.mock.calls.some((call) => Array.isArray(call[1]) && call[1].length > 0)).toBe(true);
    });

    const decorationCalls = mockEditorInstance.deltaDecorations.mock.calls
      .filter((call) => Array.isArray(call[1]) && call[1].length > 0);
    const decorations = decorationCalls[decorationCalls.length - 1]?.[1] ?? [];
    const removedDecoration = decorations.find((decoration: any) => decoration.options.className.includes('pristine-inline-git-diff-line-removed-anchor'));

    expect(removedDecoration?.options).toEqual(expect.objectContaining({
      lineNumberClassName: expect.stringContaining('pristine-inline-git-diff-line-number-removed'),
      marginClassName: expect.stringContaining('pristine-inline-git-diff-margin-removed'),
    }));
    expect(removedDecoration?.options.linesDecorationsClassName).toBeUndefined();
  });

  it('opens inline git diff details when a diff decoration is clicked and closes it from the peek controls', async () => {
    const filePath = 'rtl/core/reg_file.v';
    const currentContent = 'module reg_file;\nassign ready = valid;\nendmodule';
    mockedWorkspaceGitPathStates = { [filePath]: 'modified' };
    vi.mocked(window.electronAPI!.git.getFileDiff).mockResolvedValue({
      filePath,
      originalContent: 'module reg_file;\nassign ready = done;\nendmodule',
      currentContent,
    });

    render(
      <MonacoEditorPane
        activeTabId={filePath}
        code={currentContent}
        editorRef={createRef<any>()}
      />,
    );

    await waitFor(() => {
      expect(mockEditorInstance.deltaDecorations.mock.calls.some((call) => Array.isArray(call[1]) && call[1].length > 0)).toBe(true);
    });

    const decorationElement = document.createElement('div');
    decorationElement.className = 'pristine-inline-git-diff-line pristine-inline-git-diff-line-modified';
    const mouseDownListener = mockEditorMouseDownListeners[mockEditorMouseDownListeners.length - 1];

    act(() => {
      mouseDownListener?.({
        event: {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        },
        target: {
          element: decorationElement,
          position: { lineNumber: 2 },
        },
      });
    });

    expect(mockInlineGitDiffAddedZones).toHaveLength(1);
    const detailZone = mockInlineGitDiffAddedZones[0];
    expect(detailZone.domNode.dataset.inlineGitDiff).toBe('detail');
    expect(detailZone.heightInLines).toBe(4);
    expect(detailZone.suppressMouseDown).toBe(true);
    expect(mockEditorInstance.applyFontInfo).toHaveBeenCalledWith(detailZone.domNode);
    expect(detailZone.domNode.style.fontFamily).toBe('"Mock Editor Mono", monospace');
    expect(detailZone.domNode.style.fontSize).toBe('17px');
    expect(detailZone.domNode.style.lineHeight).toBe('24px');
    expect(detailZone.domNode.querySelector('[data-testid="monaco-inline-git-diff-detail-title"]')?.textContent).toBe('Git Local Changes - modified change');
    expect(detailZone.domNode.querySelector('[data-testid="monaco-inline-git-diff-detail-body"]')?.textContent).toContain('assign ready = done;');
    expect(detailZone.domNode.querySelector('[data-testid="monaco-inline-git-diff-detail-body"]')?.textContent).toContain('assign ready = valid;');

    const closeButton = detailZone.domNode.querySelector('[data-testid="monaco-inline-git-diff-detail-close"]') as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();
    fireEvent.click(closeButton!);
    expect(mockInlineGitDiffRemovedZones).toContain('zone-1');

    act(() => {
      mouseDownListener?.({
        event: {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        },
        target: {
          element: decorationElement,
          position: { lineNumber: 2 },
        },
      });
    });

    expect(mockInlineGitDiffAddedZones).toHaveLength(2);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockInlineGitDiffRemovedZones).toContain('zone-2');
  });

  it('sizes added-only inline git diff details so the title and changed line are visible', async () => {
    const filePath = 'rtl/core/reg_file.v';
    const currentContent = 'module reg_file;\nassign inserted = 1\'b1;\nendmodule';
    mockedWorkspaceGitPathStates = { [filePath]: 'modified' };
    vi.mocked(window.electronAPI!.git.getFileDiff).mockResolvedValue({
      filePath,
      originalContent: 'module reg_file;\nendmodule',
      currentContent,
    });

    render(
      <MonacoEditorPane
        activeTabId={filePath}
        code={currentContent}
        editorRef={createRef<any>()}
      />,
    );

    await waitFor(() => {
      expect(mockEditorInstance.deltaDecorations.mock.calls.some((call) => Array.isArray(call[1]) && call[1].length > 0)).toBe(true);
    });

    const decorationElement = document.createElement('div');
    decorationElement.className = 'pristine-inline-git-diff-margin pristine-inline-git-diff-margin-added';
    act(() => {
      mockEditorMouseDownListeners[mockEditorMouseDownListeners.length - 1]?.({
        event: {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        },
        target: {
          element: decorationElement,
          position: { lineNumber: 2 },
        },
      });
    });

    expect(mockInlineGitDiffAddedZones).toHaveLength(1);
    expect(mockInlineGitDiffAddedZones[0].heightInLines).toBe(3);
    expect(mockInlineGitDiffAddedZones[0].domNode).toHaveClass('pristine-inline-git-diff-detail-added');
    expect(mockInlineGitDiffAddedZones[0].domNode.querySelector('[data-testid="monaco-inline-git-diff-detail-title"]')?.textContent).toBe('Git Local Changes - added change');
    expect(mockInlineGitDiffAddedZones[0].domNode.querySelector('[data-testid="monaco-inline-git-diff-detail-body"]')?.textContent).toContain('assign inserted = 1\'b1;');
  });

  it('resyncs an open inline git diff detail when editor font settings change', async () => {
    const filePath = 'rtl/core/reg_file.v';
    const currentContent = 'module reg_file;\nassign ready = valid;\nendmodule';
    mockedWorkspaceGitPathStates = { [filePath]: 'modified' };
    vi.mocked(window.electronAPI!.git.getFileDiff).mockResolvedValue({
      filePath,
      originalContent: 'module reg_file;\nassign ready = done;\nendmodule',
      currentContent,
    });
    const editorRef = createRef<any>();

    const { rerender } = render(
      <MonacoEditorPane
        activeTabId={filePath}
        code={currentContent}
        editorRef={editorRef}
      />,
    );

    await waitFor(() => {
      expect(mockEditorInstance.deltaDecorations.mock.calls.some((call) => Array.isArray(call[1]) && call[1].length > 0)).toBe(true);
    });

    const decorationElement = document.createElement('div');
    decorationElement.className = 'pristine-inline-git-diff-margin pristine-inline-git-diff-margin-modified';
    act(() => {
      mockEditorMouseDownListeners[mockEditorMouseDownListeners.length - 1]?.({
        event: {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
        },
        target: {
          element: decorationElement,
          position: { lineNumber: 2 },
        },
      });
    });

    const detailZone = mockInlineGitDiffAddedZones[0];
    mockEditorInstance.applyFontInfo.mockClear();
    mockedEditorFontSize = 18;

    rerender(
      <MonacoEditorPane
        activeTabId={filePath}
        code={currentContent}
        editorRef={editorRef}
      />,
    );

    await waitFor(() => {
      expect(mockEditorInstance.updateOptions).toHaveBeenCalledWith(expect.objectContaining({ fontSize: 18 }));
    });
    expect(mockEditorInstance.applyFontInfo).toHaveBeenCalledWith(detailZone.domNode);
  });

  it('keeps inline git diff when Monaco normalizes CRLF content to LF', async () => {
    const filePath = 'rtl/core/reg_file.v';
    const editorContent = 'module reg_file;\nassign ready = valid;\nendmodule';
    mockedWorkspaceGitPathStates = { [filePath]: 'modified' };
    vi.mocked(window.electronAPI!.git.getFileDiff).mockResolvedValue({
      filePath,
      originalContent: 'module reg_file;\r\nassign ready = done;\r\nendmodule',
      currentContent: 'module reg_file;\r\nassign ready = valid;\r\nendmodule',
    });

    render(
      <MonacoEditorPane
        activeTabId={filePath}
        code={editorContent}
        editorRef={createRef<any>()}
      />,
    );

    await waitFor(() => {
      expect(mockEditorInstance.deltaDecorations.mock.calls.some((call) => Array.isArray(call[1]) && call[1].length > 0)).toBe(true);
    });

    expect(mockInlineGitDiffAddedZones).toHaveLength(0);

    const decorationCalls = mockEditorInstance.deltaDecorations.mock.calls
      .filter((call) => Array.isArray(call[1]) && call[1].length > 0);
    const decorations = decorationCalls[decorationCalls.length - 1]?.[1] ?? [];

    expect(decorations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        options: expect.objectContaining({
          className: expect.stringContaining('pristine-inline-git-diff-line-modified'),
        }),
      }),
    ]));
  });

  it('does not fetch inline git diff when disabled or while the workspace file is dirty', async () => {
    const filePath = 'rtl/core/reg_file.v';
    const onInlineGitDiffSummaryChange = vi.fn();
    mockedWorkspaceGitPathStates = { [filePath]: 'modified' };
    mockedEditorInlineGitDiffEnabled = false;

    const { rerender } = render(
      <MonacoEditorPane
        activeTabId={filePath}
        code="module reg_file; endmodule"
        editorRef={createRef<any>()}
        onInlineGitDiffSummaryChange={onInlineGitDiffSummaryChange}
      />,
    );

    expect(window.electronAPI?.git.getFileDiff).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(onInlineGitDiffSummaryChange).toHaveBeenLastCalledWith(null);
    });

    mockedEditorInlineGitDiffEnabled = true;
    rerender(
      <MonacoEditorPane
        activeTabId={filePath}
        code="module reg_file; logic dirty; endmodule"
        editorRef={createRef<any>()}
        isWorkspaceDirty
        onInlineGitDiffSummaryChange={onInlineGitDiffSummaryChange}
      />,
    );

    expect(window.electronAPI?.git.getFileDiff).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(onInlineGitDiffSummaryChange).toHaveBeenLastCalledWith(null);
    });
  });

  it('clears stale inline git diff while editing and redraws after the dirty file is saved', async () => {
    const filePath = 'rtl/core/reg_file.v';
    const savedContent = 'module reg_file;\nassign ready = valid;\nendmodule';
    const editedContent = 'module reg_file;\nassign ready = valid;\nassign changed = 1\'b1;\nendmodule';
    mockedWorkspaceGitPathStates = { [filePath]: 'modified' };
    vi.mocked(window.electronAPI!.git.getFileDiff).mockResolvedValueOnce({
      filePath,
      originalContent: 'module reg_file;\nassign ready = done;\nendmodule',
      currentContent: savedContent,
    });

    const { rerender } = render(
      <MonacoEditorPane
        activeTabId={filePath}
        code={savedContent}
        editorRef={createRef<any>()}
      />,
    );

    await waitFor(() => {
      expect(mockEditorInstance.deltaDecorations.mock.calls.some((call) => Array.isArray(call[1]) && call[1].length > 0)).toBe(true);
    });

    const decorationElement = document.createElement('div');
    decorationElement.className = 'pristine-inline-git-diff-line pristine-inline-git-diff-line-modified';
    act(() => {
      mockEditorMouseDownListeners[mockEditorMouseDownListeners.length - 1]?.({
        target: {
          element: decorationElement,
          position: { lineNumber: 2 },
        },
      });
    });
    expect(mockInlineGitDiffAddedZones).toHaveLength(1);

    vi.mocked(window.electronAPI!.git.getFileDiff).mockResolvedValueOnce({
      filePath,
      originalContent: 'module reg_file;\nassign ready = done;\nendmodule',
      currentContent: editedContent,
    });
    mockEditorInstance.deltaDecorations.mockClear();

    rerender(
      <MonacoEditorPane
        activeTabId={filePath}
        code={editedContent}
        editorRef={createRef<any>()}
        isWorkspaceDirty
      />,
    );

    await waitFor(() => {
      expect(mockInlineGitDiffRemovedZones).toContain('zone-1');
    });
    expect(mockEditorInstance.deltaDecorations).toHaveBeenCalledWith(expect.any(Array), []);
    expect(window.electronAPI?.git.getFileDiff).toHaveBeenCalledTimes(1);

    rerender(
      <MonacoEditorPane
        activeTabId={filePath}
        code={editedContent}
        editorRef={createRef<any>()}
      />,
    );

    await waitFor(() => {
      expect(window.electronAPI?.git.getFileDiff).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mockEditorInstance.deltaDecorations.mock.calls.some((call) => Array.isArray(call[1]) && call[1].length > 0)).toBe(true);
    });
  });

  it('routes plain Space key presses through Monaco typing when the text input is focused', () => {
    render(
      <MonacoEditorPane
        activeTabId="rtl/core/alu.v"
        code="assign y = a + b;"
        editorRef={createRef<any>()}
      />,
    );

    const spaceEventHandled = fireEvent.keyDown(screen.getByTestId('monaco-editor'), {
      code: 'Space',
      key: ' ',
    });

    expect(spaceEventHandled).toBe(false);
    expect(mockEditorInstance.trigger).toHaveBeenCalledWith('keyboard', 'type', { text: ' ' });
  });

  it('keeps the LSP document attached while the navigate callback updates', () => {
    const editorRef = createRef<any>();
    const initialNavigate = vi.fn();
    const nextNavigate = vi.fn();

    const { rerender } = render(
      <MonacoEditorPane
        activeTabId="rtl/core/cpu_top.sv"
        code="module cpu_top; endmodule"
        editorRef={editorRef}
        onNavigateToLocation={initialNavigate}
      />,
    );

    expect(mockedAttachLspDocument).toHaveBeenCalledTimes(1);
    expect(mockedSetNavigateHandler).toHaveBeenCalledTimes(1);

    const firstAttachArgs = mockedAttachLspDocument.mock.calls[0]?.[0] as {
      onNavigateToLocation?: (fileId: string, line: number, col: number) => void;
    };

    rerender(
      <MonacoEditorPane
        activeTabId="rtl/core/cpu_top.sv"
        code="module cpu_top; endmodule"
        editorRef={editorRef}
        onNavigateToLocation={nextNavigate}
      />,
    );

    expect(mockedAttachLspDocument).toHaveBeenCalledTimes(1);
    expect(mockedSetNavigateHandler).toHaveBeenCalledTimes(1);

    firstAttachArgs.onNavigateToLocation?.('rtl/core/alu.sv', 12, 7);

    expect(initialNavigate).not.toHaveBeenCalled();
    expect(nextNavigate).toHaveBeenCalledWith('rtl/core/alu.sv', 12, 7);
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