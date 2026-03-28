import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorArea } from './EditorArea';

const { mockEditorInstance, mockModel, mockMonaco, mockEditorComponent } = vi.hoisted(() => {
  const editorInstance = {
    onDidChangeCursorPosition: vi.fn((callback: (event: { position: { lineNumber: number; column: number } }) => void) => {
      callback({ position: { lineNumber: 12, column: 7 } });
    }),
    revealLineInCenter: vi.fn(),
    setPosition: vi.fn(),
    focus: vi.fn(),
  };

  const model = { id: 'mock-model' };

  const monaco = {
    languages: {
      getLanguages: vi.fn(() => []),
      register: vi.fn(),
      setMonarchTokensProvider: vi.fn(),
      registerCompletionItemProvider: vi.fn(),
      CompletionItemKind: { Keyword: 'keyword' },
    },
    editor: {
      defineTheme: vi.fn(),
      getModels: vi.fn(() => [model]),
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
    mockModel: model,
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
      <div
        data-testid="monaco-editor"
        data-language={props.language}
      >
        {props.value}
      </div>
    );
  },
  useMonaco: () => mockMonaco,
}));

describe('EditorArea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMonaco.languages.getLanguages.mockReturnValue([]);
    mockMonaco.editor.getModels.mockReturnValue([mockModel]);
  });

  it('renders the empty state when no tabs are open', () => {
    render(
      <EditorArea
        tabs={[]}
        activeTabId=""
        onTabChange={vi.fn()}
        onTabClose={vi.fn()}
        editorRef={createRef()}
      />,
    );

    expect(screen.getByText('RTL Studio')).toBeInTheDocument();
    expect(screen.getByText(/Open a file to start editing/i)).toBeInTheDocument();
  });

  it('switches tabs and closes a tab through the tab strip', () => {
    const onTabChange = vi.fn();
    const onTabClose = vi.fn();

    render(
      <EditorArea
        tabs={[
          { id: 'cpu_top', name: 'cpu_top.v', modified: true },
          { id: 'alu', name: 'alu.v' },
        ]}
        activeTabId="cpu_top"
        onTabChange={onTabChange}
        onTabClose={onTabClose}
        editorRef={createRef()}
      />,
    );

    fireEvent.click(screen.getByTestId('editor-tab-alu'));
    fireEvent.click(screen.getByTestId('editor-tab-close-cpu_top'));

    expect(onTabChange).toHaveBeenCalledWith('alu');
    expect(onTabClose).toHaveBeenCalledWith('cpu_top');
  });

  it('configures monaco, updates markers, reacts to cursor changes, and jumps to the target line', () => {
    const onCursorChange = vi.fn();
    const editorRef = createRef<any>();

    render(
      <EditorArea
        tabs={[{ id: 'tb_cpu', name: 'tb_cpu_top.sv' }]}
        activeTabId="tb_cpu"
        onTabChange={vi.fn()}
        onTabClose={vi.fn()}
        editorRef={editorRef}
        jumpToLine={24}
        onCursorChange={onCursorChange}
      />,
    );

    expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-language', 'systemverilog');
    expect(mockMonaco.languages.register).toHaveBeenCalled();
    expect(mockMonaco.languages.setMonarchTokensProvider).toHaveBeenCalledTimes(2);
    expect(mockMonaco.editor.defineTheme).toHaveBeenCalled();
    expect(mockMonaco.editor.setModelMarkers).toHaveBeenCalledWith(
      mockModel,
      'rtl-lint',
      expect.any(Array),
    );
    expect(onCursorChange).toHaveBeenCalledWith(12, 7);
    expect(editorRef.current).toBe(mockEditorInstance);
    expect(mockEditorInstance.revealLineInCenter).toHaveBeenCalledWith(24);
    expect(mockEditorInstance.setPosition).toHaveBeenCalledWith({ lineNumber: 24, column: 1 });
    expect(mockEditorInstance.focus).toHaveBeenCalled();
  });
});