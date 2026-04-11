import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import { useProblemsList } from '../../../../data/mockDataLoader';
import { getEditorFontFamilyStack } from '../../../editor/editorSettings';
import { registerEditorThemes } from '../../../editor/monacoThemes';
import { useRegisterEditorLanguages } from '../../../editor/registerLanguages';
import { getEditorLanguage } from '../../../workspace/workspaceFiles';
import { useEditorSettings } from '../../../context/EditorSettingsContext';

interface MonacoEditorPaneProps {
  activeTabId: string;
  code: string;
  editorRef: React.MutableRefObject<any>;
  onActiveModelReady?: (fileId: string) => void;
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
  onActiveModelReady,
  onCursorChange,
  onContentChange,
  onEditorMount,
  showDragInteractionShield,
  dragInteractionShieldTestId,
}: MonacoEditorPaneProps) {
  const monaco = useMonaco();
  const problemsList = useProblemsList();
  const { fontFamily, fontSize, theme } = useEditorSettings();
  const editorFontFamily = getEditorFontFamilyStack(fontFamily);
  const onCursorChangeRef = useRef(onCursorChange);
  const canPropagateCursorChangesRef = useRef(true);

  useEffect(() => {
    onCursorChangeRef.current = onCursorChange;
  }, [onCursorChange]);

  useEffect(() => {
    canPropagateCursorChangesRef.current = false;
  }, [activeTabId]);

  useRegisterEditorLanguages(monaco);

  useEffect(() => {
    if (!monaco) {
      return;
    }

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

    const models = monaco.editor.getModels();
    models.forEach((model: any) => {
      monaco.editor.setModelMarkers(model, 'rtl-lint', markers);
    });
  }, [activeTabId, monaco, problemsList]);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    editor.updateOptions({
      fontFamily: editorFontFamily,
      fontSize,
    });
    editor.layout();
    monaco?.editor.remeasureFonts?.();
  }, [editorFontFamily, editorRef, fontSize, monaco]);

  useEffect(() => {
    if (!activeTabId || !editorRef.current) {
      return;
    }

    onActiveModelReady?.(activeTabId);
  }, [activeTabId, editorRef, onActiveModelReady]);

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
        path={activeTabId}
        saveViewState={false}
        value={code}
        theme={theme}
        beforeMount={(nextMonaco) => {
          registerEditorThemes(nextMonaco);
        }}
        onMount={(editor) => {
          editorRef.current = editor;
          onEditorMount?.(editor);
          editor.onDidFocusEditorText?.(() => {
            canPropagateCursorChangesRef.current = true;
          });
          editor.onDidChangeCursorPosition((event: any) => {
            if (!canPropagateCursorChangesRef.current) {
              return;
            }

            const editorDomNode = editor.getDomNode?.();
            const activeElement = editorDomNode?.ownerDocument?.activeElement;

            if (editorDomNode && activeElement && !editorDomNode.contains(activeElement)) {
              return;
            }

            if (typeof editor.hasTextFocus === 'function' && !editor.hasTextFocus()) {
              return;
            }

            onCursorChangeRef.current?.(event.position.lineNumber, event.position.column);
          });
        }}
        onChange={(value) => {
          onContentChange?.(value ?? '');
        }}
        options={{
          fontSize,
          fontFamily: editorFontFamily,
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