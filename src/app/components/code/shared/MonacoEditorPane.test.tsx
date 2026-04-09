import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Problem } from '../../../../data/mockData';
import { IDE_MONO_FONT_FAMILY } from '../../../editor/appearance';

const mockedUseRegisterEditorLanguages = vi.fn();
const mockedDefineDraculaTheme = vi.fn();
const mockedGetEditorLanguage = vi.fn((filePath: string) => (filePath.endsWith('.sv') ? 'systemverilog' : 'verilog'));
let mockedProblems: Problem[] = [];

const { mockEditorInstance, mockModels, mockMonaco, mockEditorComponent } = vi.hoisted(() => {
  const editorInstance = {
    onDidChangeCursorPosition: vi.fn((callback: (event: { position: { lineNumber: number; column: number } }) => void) => {
      callback({ position: { lineNumber: 5, column: 10 } });
    }),
  };

  const models = [{ id: 'model-a' }, { id: 'model-b' }];
  const monaco = {
    editor: {
      getModels: vi.fn(() => models),
      setModelMarkers: vi.fn(),
    },
    MarkerSeverity: {
      Error: 8,
      Warning: 4,
      Info: 2,
    },
  };

  return {
    mockEditorInstance: editorInstance,
    mockModels: models,
    mockMonaco: monaco,
    mockEditorComponent: vi.fn(),
  };
});

vi.mock('@monaco-editor/react', () => ({
  default: (props: any) => {
    mockEditorComponent(props);
    props.beforeMount?.(mockMonaco);
    props.onMount?.(mockEditorInstance);

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

vi.mock('../../../editor/draculaTheme', () => ({
  defineDraculaTheme: (monaco: unknown) => mockedDefineDraculaTheme(monaco),
}));

vi.mock('../../../editor/registerLanguages', () => ({
  useRegisterEditorLanguages: (monaco: unknown) => mockedUseRegisterEditorLanguages(monaco),
}));

vi.mock('../../../workspace/workspaceFiles', () => ({
  getEditorLanguage: (filePath: string) => mockedGetEditorLanguage(filePath),
}));

import { MonacoEditorPane } from './MonacoEditorPane';

describe('MonacoEditorPane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedProblems = [];
    mockMonaco.editor.getModels.mockReturnValue(mockModels);
  });

  it('configures the editor and exposes mount callbacks', () => {
    const editorRef = createRef<any>();
    const onEditorMount = vi.fn();
    const onCursorChange = vi.fn();

    render(
      <MonacoEditorPane
        activeTabId="rtl/core/cpu_top.sv"
        code="module cpu_top; endmodule"
        editorRef={editorRef}
        onEditorMount={onEditorMount}
        onCursorChange={onCursorChange}
      />,
    );

    expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-language', 'systemverilog');
    expect(screen.getByTestId('monaco-editor')).toHaveTextContent('module cpu_top; endmodule');
    expect(mockedGetEditorLanguage).toHaveBeenCalledWith('rtl/core/cpu_top.sv');
    expect(mockedUseRegisterEditorLanguages).toHaveBeenCalledWith(mockMonaco);
    expect(mockedDefineDraculaTheme).toHaveBeenCalledWith(mockMonaco);
    expect(editorRef.current).toBe(mockEditorInstance);
    expect(onEditorMount).toHaveBeenCalledWith(mockEditorInstance);
    expect(onCursorChange).toHaveBeenCalledWith(5, 10);

    const editorCalls = mockEditorComponent.mock.calls;
    const lastEditorProps = editorCalls[editorCalls.length - 1]?.[0];
    expect(lastEditorProps.options.fontFamily).toBe(IDE_MONO_FONT_FAMILY);
    expect(lastEditorProps.theme).toBe('dracula');
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
});