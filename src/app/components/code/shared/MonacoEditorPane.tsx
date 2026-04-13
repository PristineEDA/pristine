import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import { useProblemsList } from '../../../../data/mockDataLoader';
import { getEditorFontFamilyStack } from '../../../editor/editorSettings';
import { registerEditorThemes } from '../../../editor/monacoThemes';
import { useRegisterEditorLanguages } from '../../../editor/registerLanguages';
import { getEditorLanguage } from '../../../workspace/workspaceFiles';
import { useEditorSettings } from '../../../context/EditorSettingsContext';

interface EditorViewport {
  width: number;
  height: number;
}

function hasFocusedEditorText(editor: any) {
  const editorDomNode = editor?.getDomNode?.();
  const activeElement = editorDomNode?.ownerDocument?.activeElement;
  const hasDomFocus = Boolean(editorDomNode && activeElement && editorDomNode.contains(activeElement));
  const hasTextFocus = typeof editor?.hasTextFocus === 'function'
    ? editor.hasTextFocus()
    : hasDomFocus;

  return hasTextFocus || hasDomFocus;
}

function getRenderableEditorViewport(element: HTMLDivElement | null): EditorViewport | null {
  if (!element) {
    return null;
  }

  const width = element.clientWidth;
  const height = element.clientHeight;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

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
  const hostRef = useRef<HTMLDivElement | null>(null);
  const layoutFrameRef = useRef<number | null>(null);
  const queueEditorLayoutRef = useRef<() => void>(() => undefined);

  queueEditorLayoutRef.current = () => {
    const applyLayout = () => {
      layoutFrameRef.current = null;

      const editor = editorRef.current;
      const viewport = getRenderableEditorViewport(hostRef.current);

      if (!editor || !viewport) {
        return;
      }

      editor.layout(viewport);
    };

    if (typeof window === 'undefined' || !('requestAnimationFrame' in window)) {
      applyLayout();
      return;
    }

    if (layoutFrameRef.current !== null) {
      window.cancelAnimationFrame(layoutFrameRef.current);
    }

    layoutFrameRef.current = window.requestAnimationFrame(applyLayout);
  };

  useEffect(() => {
    onCursorChangeRef.current = onCursorChange;
  }, [onCursorChange]);

  useEffect(() => {
    canPropagateCursorChangesRef.current = false;
  }, [activeTabId]);

  useRegisterEditorLanguages(monaco);

  useEffect(() => {
    queueEditorLayoutRef.current();

    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      queueEditorLayoutRef.current();
    });

    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined' || layoutFrameRef.current === null) {
        return;
      }

      window.cancelAnimationFrame(layoutFrameRef.current);
      layoutFrameRef.current = null;
    };
  }, []);

  useEffect(() => {
    queueEditorLayoutRef.current();
  }, [showDragInteractionShield]);

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
    queueEditorLayoutRef.current();
    monaco?.editor.remeasureFonts?.();
  }, [editorFontFamily, editorRef, fontSize, monaco]);

  useEffect(() => {
    if (!activeTabId || !editorRef.current) {
      return;
    }

    onActiveModelReady?.(activeTabId);
    queueEditorLayoutRef.current();
  }, [activeTabId, editorRef, onActiveModelReady]);

  return (
    <div ref={hostRef} className="relative flex-1 overflow-hidden bg-background">
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
        keepCurrentModel
        saveViewState={false}
        value={code}
        theme={theme}
        beforeMount={(nextMonaco) => {
          registerEditorThemes(nextMonaco);
        }}
        onMount={(editor) => {
          editorRef.current = editor;
          if (activeTabId) {
            onActiveModelReady?.(activeTabId);
          }
          queueEditorLayoutRef.current();
          onEditorMount?.(editor);
          editor.onDidFocusEditorText?.(() => {
            canPropagateCursorChangesRef.current = true;
          });
          editor.onDidChangeCursorPosition((event: any) => {
            const focusedEditorText = hasFocusedEditorText(editor);

            if (!focusedEditorText) {
              return;
            }

            if (!canPropagateCursorChangesRef.current) {
              canPropagateCursorChangesRef.current = true;
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