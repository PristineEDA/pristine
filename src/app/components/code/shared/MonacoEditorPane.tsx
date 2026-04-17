import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
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
  const {
    cursorBlinking,
    bracketPairGuides,
    fontFamily,
    fontLigatures,
    fontSize,
    foldingStrategy,
    glyphMargin,
    indentGuides,
    lineNumbers,
    minimapEnabled,
    renderControlCharacters,
    renderWhitespace,
    scrollBeyondLastLine,
    smoothScrolling,
    tabSize,
    theme,
    wordWrap,
  } = useEditorSettings();
  const editorFontFamily = getEditorFontFamilyStack(fontFamily);
  const editorLanguage = getEditorLanguage(activeTabId);
  const monacoInstanceRef = useRef(monaco);
  const canPropagateCursorChangesRef = useRef(true);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const layoutFrameRef = useRef<number | null>(null);
  const [mountedEditor, setMountedEditor] = useState<any>(null);
  const queueEditorLayoutRef = useRef<() => void>(() => undefined);
  const isSystemVerilogDocumentReady = Boolean(activeTabId) && editorLanguage === 'systemverilog' && isDocumentReady && !hasLoadError;
  const handleActiveModelReady = useEffectEvent((fileId: string) => {
    onActiveModelReady?.(fileId);
  });
  const handleContentChange = useEffectEvent((value: string) => {
    onContentChange?.(value);
  });
  const handleCursorChange = useEffectEvent((line: number, col: number) => {
    onCursorChange?.(line, col);
  });
  const handleEditorMount = useEffectEvent((editor: any) => {
    onEditorMount?.(editor);
  });
  const handleNavigateToLocation = useEffectEvent((fileId: string, line: number, col: number) => {
    onNavigateToLocation?.(fileId, line, col);
  });
  const handleSaveShortcut = useEffectEvent(() => {
    onSaveShortcut?.();
  });
  const editorBehaviorOptions = useMemo(() => ({
    cursorBlinking,
    fontFamily: editorFontFamily,
    fontLigatures,
    fontSize,
    foldingStrategy,
    glyphMargin,
    guides: {
      bracketPairs: bracketPairGuides,
      indentation: indentGuides,
    },
    lineNumbers,
    minimap: { enabled: minimapEnabled, scale: 1, showSlider: 'mouseover' as const },
    renderControlCharacters,
    renderWhitespace,
    scrollBeyondLastLine,
    smoothScrolling,
    tabSize,
    wordWrap,
  }), [
    bracketPairGuides,
    cursorBlinking,
    editorFontFamily,
    foldingStrategy,
    fontLigatures,
    fontSize,
    glyphMargin,
    indentGuides,
    lineNumbers,
    minimapEnabled,
    renderControlCharacters,
    renderWhitespace,
    scrollBeyondLastLine,
    smoothScrolling,
    tabSize,
    wordWrap,
  ]);
  const editorOptions = useMemo(() => ({
    ...editorBehaviorOptions,
    lineNumbersMinChars: 4,
    folding: true,
    automaticLayout: true,
    insertSpaces: true,
    rulers: [80, 120],
    bracketPairColorization: { enabled: true },
    suggest: { showKeywords: true, showSnippets: true },
    quickSuggestions: { other: true, comments: false, strings: false },
    parameterHints: { enabled: true },
    scrollbar: {
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8,
    },
    padding: { top: 8 },
  }), [editorBehaviorOptions]);

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

    systemVerilogLspBridge.ensureRegistered(monaco);
  }, [monaco]);

  useEffect(() => {
    if (!mountedEditor) {
      return;
    }

    systemVerilogLspBridge.setNavigateHandler(
      mountedEditor,
      isSystemVerilogDocumentReady ? handleNavigateToLocation : undefined,
    );
  }, [isSystemVerilogDocumentReady, mountedEditor]);

  useEffect(() => {
    if (!monaco || !mountedEditor || !isSystemVerilogDocumentReady) {
      return;
    }

    return systemVerilogLspBridge.attachDocument({
      monaco,
      editor: mountedEditor,
      filePath: activeTabId,
      text: code,
      onNavigateToLocation: handleNavigateToLocation,
    });
  }, [activeTabId, isSystemVerilogDocumentReady, monaco, mountedEditor]);

  useEffect(() => {
    if (!isSystemVerilogDocumentReady) {
      return;
    }

    systemVerilogLspBridge.updateDocument(activeTabId, code);
  }, [activeTabId, code, isSystemVerilogDocumentReady]);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    editor.updateOptions(editorBehaviorOptions);
    queueEditorLayoutRef.current();
  }, [editorBehaviorOptions, editorRef]);

  useEffect(() => {
    monaco?.editor.remeasureFonts?.();
  }, [editorFontFamily, fontLigatures, fontSize, monaco]);

  useEffect(() => {
    if (!activeTabId || !mountedEditor) {
      return;
    }

    handleActiveModelReady(activeTabId);
    queueEditorLayoutRef.current();
  }, [activeTabId, mountedEditor]);

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
            handleActiveModelReady(activeTabId);
          }
          queueEditorLayoutRef.current();
          handleEditorMount(editor);
          if (
            onSaveShortcut
            && typeof editor.addCommand === 'function'
            && typeof activeMonaco?.KeyMod?.CtrlCmd === 'number'
            && typeof activeMonaco?.KeyCode?.KeyS === 'number'
          ) {
            editor.addCommand(activeMonaco.KeyMod.CtrlCmd | activeMonaco.KeyCode.KeyS, () => {
              handleSaveShortcut();
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

            handleCursorChange(event.position.lineNumber, event.position.column);
          });
        }}
        onChange={(value) => {
          handleContentChange(value ?? '');
        }}
        options={editorOptions}
      />
    </div>
  );
}