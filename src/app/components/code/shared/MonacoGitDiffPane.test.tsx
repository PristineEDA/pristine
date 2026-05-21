import { render, screen, waitFor } from '@/test/render';
import { describe, expect, it, vi } from 'vitest';
import { MonacoGitDiffPane } from './MonacoGitDiffPane';

const diffEditorMockState = vi.hoisted(() => ({
  props: { current: null as Record<string, unknown> | null },
  instance: {
    layout: vi.fn(),
    getModifiedEditor: vi.fn(() => ({ id: 'modified-editor' })),
  },
  monaco: {
    editor: {
      remeasureFonts: vi.fn(),
    },
  },
}));

vi.mock('@monaco-editor/react', () => ({
  DiffEditor: vi.fn((props: Record<string, unknown>) => {
    diffEditorMockState.props.current = props;
    if (typeof props.beforeMount === 'function') {
      props.beforeMount(diffEditorMockState.monaco);
    }
    if (typeof props.onMount === 'function') {
      props.onMount(diffEditorMockState.instance);
    }

    return (
      <div
        data-testid="mock-diff-editor"
        data-language={String(props.language)}
        data-original={String(props.original)}
        data-modified={String(props.modified)}
      />
    );
  }),
  useMonaco: () => diffEditorMockState.monaco,
}));

vi.mock('../../../editor/configureMonacoLoader', () => ({}));

vi.mock('../../../editor/registerLanguages', () => ({
  useRegisterEditorLanguages: vi.fn(),
}));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    themeId: 'pristine-dark',
    activeTheme: {
      name: 'Pristine Dark',
      colors: {},
      tokenColors: [],
    },
  }),
}));

vi.mock('../../../context/EditorSettingsContext', () => ({
  useEditorSettings: () => ({
    cursorBlinking: 'blink',
    bracketPairGuides: true,
    fontFamily: 'default',
    fontLigatures: false,
    fontSize: 13,
    foldingStrategy: 'auto',
    glyphMargin: true,
    indentGuides: true,
    lineNumbers: 'on',
    minimapEnabled: true,
    renderControlCharacters: false,
    renderWhitespace: 'selection',
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    tabSize: 2,
    wordWrap: 'off',
  }),
}));

vi.mock('../../../theme/monacoColorTheme', () => ({
  defineMonacoTheme: vi.fn(),
  registerBuiltInMonacoThemes: vi.fn(),
}));

describe('MonacoGitDiffPane', () => {
  it('loads HEAD and workspace content into a read-only Monaco diff editor', async () => {
    const onEditorMount = vi.fn();
    vi.mocked(window.electronAPI!.git.getFileDiff).mockResolvedValueOnce({
      filePath: 'rtl/core/reg_file.v',
      originalContent: 'module reg_file;\nendmodule\n',
      currentContent: 'module reg_file;\n// changed\nendmodule\n',
    });

    render(<MonacoGitDiffPane filePath="rtl/core/reg_file.v" onEditorMount={onEditorMount} />);

    expect(screen.getByTestId('monaco-git-diff-loading')).toBeInTheDocument();
    const diffEditor = await screen.findByTestId('mock-diff-editor');

    expect(window.electronAPI!.git.getFileDiff).toHaveBeenCalledWith('rtl/core/reg_file.v');
    expect(diffEditor).toHaveAttribute('data-language', 'verilog');
    expect(diffEditor).toHaveAttribute('data-original', 'module reg_file;\nendmodule\n');
    expect(diffEditor).toHaveAttribute('data-modified', 'module reg_file;\n// changed\nendmodule\n');
    expect(diffEditorMockState.props.current?.options).toEqual(expect.objectContaining({
      readOnly: true,
      originalEditable: false,
      renderSideBySide: true,
    }));
    expect(onEditorMount).toHaveBeenCalledWith({ id: 'modified-editor' });
  });

  it('renders an error state when the git diff request fails', async () => {
    vi.mocked(window.electronAPI!.git.getFileDiff).mockRejectedValueOnce(new Error('fatal: path does not exist in HEAD'));

    render(<MonacoGitDiffPane filePath="rtl/core/reg_file.v" />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-git-diff-error')).toHaveTextContent('fatal: path does not exist in HEAD');
    });
    expect(screen.queryByTestId('mock-diff-editor')).not.toBeInTheDocument();
  });
});
