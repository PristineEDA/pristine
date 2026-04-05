import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect } from 'react';
import { useProblemsList } from '../../data/mockDataLoader';
import { IDE_MONO_FONT_FAMILY } from '../editor/appearance';
import { defineDraculaTheme } from '../editor/draculaTheme';
import { useRegisterEditorLanguages } from '../editor/registerLanguages';
import { getEditorLanguage } from '../workspace/workspaceFiles';

interface MonacoEditorPaneProps {
  activeTabId: string;
  code: string;
  editorRef: React.MutableRefObject<any>;
  onCursorChange?: (line: number, col: number) => void;
  onContentChange?: (value: string) => void;
  onEditorMount?: (editor: any) => void;
  showDragInteractionShield?: boolean;
  dragInteractionShieldTestId?: string;
}

export function MonacoEditorPane({
  activeTabId,
  code,
  editorRef,
  onCursorChange,
  onContentChange,
  onEditorMount,
  showDragInteractionShield,
  dragInteractionShieldTestId,
}: MonacoEditorPaneProps) {
  const monaco = useMonaco();
  const problemsList = useProblemsList();

  useRegisterEditorLanguages(monaco);

  useEffect(() => {
    if (!monaco) {
      return;
    }

    const models = monaco.editor.getModels();
    models.forEach((model: any) => {
      const issues = problemsList.filter((problem) => problem.fileId === activeTabId);
      const markers = issues.map((problem) => ({
        severity: problem.severity === 'error'
          ? monaco.MarkerSeverity.Error
          : problem.severity === 'warning'
          ? monaco.MarkerSeverity.Warning
          : monaco.MarkerSeverity.Info,
        startLineNumber: problem.line,
        startColumn: problem.column,
        endLineNumber: problem.line,
        endColumn: problem.column + 30,
        message: problem.message,
        code: problem.code,
        source: problem.source,
      }));
      monaco.editor.setModelMarkers(model, 'rtl-lint', markers);
    });
  }, [activeTabId, monaco, problemsList]);

  return (
    <div className="relative flex-1 overflow-hidden bg-background">
      {showDragInteractionShield && (
        <div
          data-testid={dragInteractionShieldTestId}
          className="absolute inset-0 z-10 cursor-grabbing bg-transparent"
          aria-hidden="true"
        />
      )}
      <Editor
        height="100%"
        language={getEditorLanguage(activeTabId)}
        value={code}
        theme="dracula"
        beforeMount={(nextMonaco) => {
          defineDraculaTheme(nextMonaco);
        }}
        onMount={(editor) => {
          editorRef.current = editor;
          onEditorMount?.(editor);
          editor.onDidChangeCursorPosition((event: any) => {
            onCursorChange?.(event.position.lineNumber, event.position.column);
          });
        }}
        onChange={(value) => {
          onContentChange?.(value ?? '');
        }}
        options={{
          fontSize: 13,
          fontFamily: IDE_MONO_FONT_FAMILY,
          fontLigatures: true,
          lineNumbers: 'on',
          lineNumbersMinChars: 4,
          glyphMargin: true,
          folding: true,
          foldingStrategy: 'indentation',
          minimap: { enabled: true, scale: 1, showSlider: 'mouseover' },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,
          wordWrap: 'off',
          rulers: [80, 120],
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          suggest: { showKeywords: true, showSnippets: true },
          quickSuggestions: { other: true, comments: false, strings: false },
          parameterHints: { enabled: true },
          cursorBlinking: 'smooth',
          smoothScrolling: true,
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          padding: { top: 8 },
        }}
      />
    </div>
  );
}