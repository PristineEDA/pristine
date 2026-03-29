import { createRef } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    const electronApi = window.electronAPI!;

    vi.clearAllMocks();
    mockMonaco.languages.getLanguages.mockReturnValue([]);
    mockMonaco.editor.getModels.mockReturnValue([mockModel]);
    vi.mocked(electronApi.fs.readFile).mockResolvedValue('// fixture content');
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
          { id: 'rtl/core/cpu_top.v', name: 'cpu_top.v', modified: true },
          { id: 'rtl/core/alu.v', name: 'alu.v' },
        ]}
        activeTabId="rtl/core/cpu_top.v"
        onTabChange={onTabChange}
        onTabClose={onTabClose}
        editorRef={createRef()}
      />,
    );

    fireEvent.click(screen.getByTestId('editor-tab-rtl/core/alu.v'));
    fireEvent.click(screen.getByTestId('editor-tab-close-rtl/core/cpu_top.v'));

    expect(onTabChange).toHaveBeenCalledWith('rtl/core/alu.v');
    expect(onTabClose).toHaveBeenCalledWith('rtl/core/cpu_top.v');
  });

  it('configures monaco, loads file content, reacts to cursor changes, and jumps to the target line', async () => {
    const onCursorChange = vi.fn();
    const editorRef = createRef<any>();

    render(
      <EditorArea
        tabs={[{ id: 'rtl/tb/tb_cpu_top.sv', name: 'tb_cpu_top.sv' }]}
        activeTabId="rtl/tb/tb_cpu_top.sv"
        onTabChange={vi.fn()}
        onTabClose={vi.fn()}
        editorRef={editorRef}
        jumpToLine={24}
        onCursorChange={onCursorChange}
      />,
    );

    await waitFor(() => {
      expect(window.electronAPI!.fs.readFile).toHaveBeenCalledWith('rtl/tb/tb_cpu_top.sv', 'utf-8');
    });

    expect(screen.getByTestId('monaco-editor')).toHaveAttribute('data-language', 'systemverilog');
    expect(screen.getByText('retroSoC')).toBeInTheDocument();
    expect(screen.getAllByText('tb_cpu_top.sv')).toHaveLength(2);
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