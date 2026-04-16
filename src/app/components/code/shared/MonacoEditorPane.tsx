import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect, useRef, useState } from 'react';
import { useProblemsList } from '../../../../data/mockDataLoader';
import '../../../editor/configureMonacoLoader';
import { getEditorFontFamilyStack } from '../../../editor/editorSettings';
import { registerEditorThemes } from '../../../editor/monacoThemes';
import { useRegisterEditorLanguages } from '../../../editor/registerLanguages';
import { systemVerilogLspBridge } from '../../../lsp/systemVerilogLspBridge';
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
  onSaveShortcut?: () => void;
  onContentChange?: (value: string) => void;
  onEditorMount?: (editor: any) => void;
  onNavigateToLocation?: (fileId: string, line: number, col: number) => void;
  isDocumentReady?: boolean;
  hasLoadError?: boolean;
  showDragInteractionShield?: boolean;
  dragInteractionShieldTestId?: string;
}

export function MonacoEditorPane({
  activeTabId,
  code,
  editorRef,
  onActiveModelReady,
  onCursorChange,
  onSaveShortcut,
  onContentChange,
  onEditorMount,
  onNavigateToLocation,
  isDocumentReady = true,
  hasLoadError = false,
  showDragInteractionShield,
  dragInteractionShieldTestId,
}: MonacoEditorPaneProps) {
  const monaco = useMonaco();
  const problemsList = useProblemsList();
  const {
    bracketPairGuides,
    fontFamily,
    fontSize,
    glyphMargin,
    indentGuides,
    lineNumbers,
    minimapEnabled,
    renderControlCharacters,
    renderWhitespace,
    theme,
    wordWrap,
  } = useEditorSettings();
  const editorFontFamily = getEditorFontFamilyStack(fontFamily);
  const editorLanguage = getEditorLanguage(activeTabId);
  const onCursorChangeRef = useRef(onCursorChange);
  const monacoInstanceRef = useRef(monaco);
  const canPropagateCursorChangesRef = useRef(true);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const layoutFrameRef = useRef<number | null>(null);
  const [mountedEditor, setMountedEditor] = useState<any>(null);
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
    monacoInstanceRef.current = monaco;
  }, [monaco]);

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
    const normalizedActiveTabId = activeTabId.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
    const hasModelPaths = models.some((model: any) => typeof model?.uri?.path === 'string' || typeof model?.uri?.fsPath === 'string');

    models.forEach((model: any) => {
      if (!hasModelPaths) {
        monaco.editor.setModelMarkers(model, 'rtl-lint', markers);
        return;
      }

      const modelPath = typeof model?.uri?.path === 'string'
        ? model.uri.path
        : typeof model?.uri?.fsPath === 'string'
        ? model.uri.fsPath
        : '';
      const normalizedModelPath = modelPath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');

      monaco.editor.setModelMarkers(
        model,
        'rtl-lint',
        normalizedModelPath === normalizedActiveTabId ? markers : [],
      );
    });
  }, [activeTabId, monaco, problemsList]);

  useEffect(() => {
    if (!monaco) {
      return;
    }

    systemVerilogLspBridge.ensureRegistered(monaco);
  }, [monaco]);

  useEffect(() => {
    if (!mountedEditor || editorLanguage !== 'systemverilog') {
      return;
    }

    systemVerilogLspBridge.setNavigateHandler(mountedEditor, onNavigateToLocation);
  }, [editorLanguage, mountedEditor, onNavigateToLocation]);

  useEffect(() => {
    if (!monaco || !mountedEditor || !activeTabId || editorLanguage !== 'systemverilog' || !isDocumentReady || hasLoadError) {
      return;
    }

    return systemVerilogLspBridge.attachDocument({
      monaco,
      editor: mountedEditor,
      filePath: activeTabId,
      text: code,
      onNavigateToLocation,
    });
  }, [activeTabId, editorLanguage, hasLoadError, isDocumentReady, monaco, mountedEditor]);

  useEffect(() => {
    if (!activeTabId || editorLanguage !== 'systemverilog' || !isDocumentReady || hasLoadError) {
      return;
    }

    systemVerilogLspBridge.updateDocument(activeTabId, code);
  }, [activeTabId, code, editorLanguage, hasLoadError, isDocumentReady]);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    editor.updateOptions({
      glyphMargin,
      fontFamily: editorFontFamily,
      fontSize,
      guides: {
        bracketPairs: bracketPairGuides,
        indentation: indentGuides,
      },
      lineNumbers,
      minimap: { enabled: minimapEnabled, scale: 1, showSlider: 'mouseover' },
      renderControlCharacters,
      renderWhitespace,
      wordWrap,
    });
    queueEditorLayoutRef.current();
    monaco?.editor.remeasureFonts?.();
  }, [
    bracketPairGuides,
    editorFontFamily,
    editorRef,
    fontSize,
    glyphMargin,
    indentGuides,
    lineNumbers,
    minimapEnabled,
    monaco,
    renderControlCharacters,
    renderWhitespace,
    wordWrap,
  ]);

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
        language={editorLanguage}
        path={activeTabId}
        keepCurrentModel
        saveViewState={false}
        value={code}
        theme={theme}
        beforeMount={(nextMonaco) => {
          monacoInstanceRef.current = nextMonaco;
          registerEditorThemes(nextMonaco);
        }}
        onMount={(editor) => {
          const activeMonaco = monacoInstanceRef.current;

          editorRef.current = editor;
          setMountedEditor(editor);
          if (activeTabId) {
            onActiveModelReady?.(activeTabId);
          }
          queueEditorLayoutRef.current();
          onEditorMount?.(editor);
          if (
            onSaveShortcut
            && typeof editor.addCommand === 'function'
            && typeof activeMonaco?.KeyMod?.CtrlCmd === 'number'
            && typeof activeMonaco?.KeyCode?.KeyS === 'number'
          ) {
            editor.addCommand(activeMonaco.KeyMod.CtrlCmd | activeMonaco.KeyCode.KeyS, () => {
              onSaveShortcut();
            });
          }
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
          lineNumbers,
          lineNumbersMinChars: 4,
          glyphMargin,
          folding: true,
          foldingStrategy: 'indentation',
          minimap: { enabled: minimapEnabled, scale: 1, showSlider: 'mouseover' },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,
          wordWrap,
          rulers: [80, 120],
          renderWhitespace,
          renderControlCharacters,
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: bracketPairGuides, indentation: indentGuides },
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