import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import '../../../editor/configureMonacoLoader';
import { isMonacoTextInputElement } from '../../../editor/focusEditor';
import { useRegisterEditorLanguages } from '../../../editor/registerLanguages';
import { systemVerilogLspBridge } from '../../../lsp/systemVerilogLspBridge';
import { computeInlineGitDiff, getInlineGitDiffLineCounts, type InlineGitDiffSummary } from '../../../editor/gitInlineDiff';
import { getEditorLanguage } from '../../../workspace/workspaceFiles';
import { useTheme } from '../../../context/ThemeContext';
import { useEditorSettings } from '../../../context/EditorSettingsContext';
import { getWorkspaceGitPathState, useWorkspaceGitStatus } from '../../../git/workspaceGitStatus';
import { createMonacoInlineGitDiffController, type MonacoInlineGitDiffController } from '../../../editor/monacoInlineGitDiff';
import { defineMonacoTheme, registerBuiltInMonacoThemes } from '../../../theme/monacoColorTheme';
import { useMonacoEditorOptions } from './useMonacoEditorOptions';

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

function normalizeEditorContentForInlineDiff(content: string) {
  return content.replace(/\r\n?/g, '\n');
}

function isInlineGitDiffPathState(state: string | undefined) {
  return state === 'modified' || state === 'created';
}

interface MonacoEditorPaneProps {
  activeTabId: string;
  code: string;
  onCloseShortcut?: () => void;
  editorRef: React.MutableRefObject<any>;
  onActiveModelReady?: (fileId: string) => void;
  onCursorChange?: (line: number, col: number) => void;
  onSaveShortcut?: () => void;
  onContentChange?: (value: string) => void;
  onEditorMount?: (editor: any) => void;
  onInlineGitDiffSummaryChange?: (summary: InlineGitDiffSummary | null) => void;
  onNavigateToLocation?: (fileId: string, line: number, col: number) => void;
  onNewShortcut?: () => void;
  isDocumentReady?: boolean;
  hasLoadError?: boolean;
  isWorkspaceDirty?: boolean;
  showDragInteractionShield?: boolean;
  dragInteractionShieldTestId?: string;
}

export function MonacoEditorPane({
  activeTabId,
  code,
  onCloseShortcut,
  editorRef,
  onActiveModelReady,
  onCursorChange,
  onSaveShortcut,
  onContentChange,
  onEditorMount,
  onInlineGitDiffSummaryChange,
  onNavigateToLocation,
  onNewShortcut,
  isDocumentReady = true,
  hasLoadError = false,
  isWorkspaceDirty = false,
  showDragInteractionShield,
  dragInteractionShieldTestId,
}: MonacoEditorPaneProps) {
  const monaco = useMonaco();
  const { activeTheme, themeId } = useTheme();
  const { inlineGitDiffEnabled, inlineGitDiffStateBackgroundsEnabled } = useEditorSettings();
  const gitStatus = useWorkspaceGitStatus();
  const { editorBehaviorOptions, editorFontFamily, editorOptions } = useMonacoEditorOptions();
  const editorLanguage = getEditorLanguage(activeTabId);
  const gitPathState = getWorkspaceGitPathState(gitStatus, activeTabId);
  const monacoInstanceRef = useRef(monaco);
  const canPropagateCursorChangesRef = useRef(true);
  const codeRef = useRef(code);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const inlineGitDiffAppliedContentRef = useRef<string | null>(null);
  const inlineGitDiffControllerRef = useRef<MonacoInlineGitDiffController | null>(null);
  const inlineGitDiffRequestRef = useRef(0);
  const lastLayoutViewportRef = useRef<EditorViewport | null>(null);
  const [mountedEditor, setMountedEditor] = useState<any>(null);
  const applyEditorLayoutRef = useRef<(options?: { force?: boolean }) => void>(() => undefined);
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
  const handleInlineGitDiffSummaryChange = useEffectEvent((summary: InlineGitDiffSummary | null) => {
    onInlineGitDiffSummaryChange?.(summary);
  });
  const handleNavigateToLocation = useEffectEvent((fileId: string, line: number, col: number) => {
    onNavigateToLocation?.(fileId, line, col);
  });
  const handleSaveShortcut = useEffectEvent(() => {
    onSaveShortcut?.();
  });
  const handleNewShortcut = useEffectEvent(() => {
    onNewShortcut?.();
  });
  const handleCloseShortcut = useEffectEvent(() => {
    onCloseShortcut?.();
  });
  const handlePlainSpaceKeyDownCapture = useEffectEvent((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const nativeEvent = event.nativeEvent as KeyboardEvent & { isComposing?: boolean };

    if (
      event.defaultPrevented
      || event.altKey
      || event.ctrlKey
      || event.metaKey
      || nativeEvent.isComposing
      || (event.key !== ' ' && event.code !== 'Space')
      || !isMonacoTextInputElement(event.target)
    ) {
      return;
    }

    const editor = editorRef.current;

    if (!editor || !hasFocusedEditorText(editor)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (typeof editor.trigger === 'function') {
      editor.trigger('keyboard', 'type', { text: ' ' });
      return;
    }

    const selection = editor.getSelection?.();

    if (selection && typeof editor.executeEdits === 'function') {
      editor.executeEdits('keyboard', [{ range: selection, text: ' ', forceMoveMarkers: true }]);
    }
  });
  applyEditorLayoutRef.current = ({ force = false }: { force?: boolean } = {}) => {
    const editor = editorRef.current;
    const viewport = getRenderableEditorViewport(hostRef.current);

    if (!editor || !viewport) {
      return;
    }

    const lastViewport = lastLayoutViewportRef.current;
    if (!force && lastViewport && lastViewport.width === viewport.width && lastViewport.height === viewport.height) {
      return;
    }

    editor.layout(viewport);
    lastLayoutViewportRef.current = viewport;
  };

  useEffect(() => {
    monacoInstanceRef.current = monaco;
  }, [monaco]);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  const clearInlineGitDiff = () => {
    inlineGitDiffRequestRef.current += 1;
    inlineGitDiffAppliedContentRef.current = null;
    inlineGitDiffControllerRef.current?.clear();
    handleInlineGitDiffSummaryChange(null);
  };

  useEffect(() => {
    if (!mountedEditor) {
      return;
    }

    const controller = createMonacoInlineGitDiffController(mountedEditor, monacoInstanceRef.current, {
      stateBackgroundsVisible: inlineGitDiffStateBackgroundsEnabled,
    });
    inlineGitDiffControllerRef.current = controller;

    return () => {
      controller.dispose();
      if (inlineGitDiffControllerRef.current === controller) {
        inlineGitDiffControllerRef.current = null;
      }
    };
  }, [mountedEditor, monaco]);

  useEffect(() => {
    inlineGitDiffControllerRef.current?.setStateBackgroundsVisible(inlineGitDiffStateBackgroundsEnabled);
  }, [inlineGitDiffStateBackgroundsEnabled]);

  useEffect(() => {
    const appliedContent = inlineGitDiffAppliedContentRef.current;
    if (appliedContent !== null && appliedContent !== code) {
      clearInlineGitDiff();
    }
  }, [code]);

  useEffect(() => {
    const editor = mountedEditor;
    const gitApi = window.electronAPI?.git;
    const getFileDiff = gitApi?.getFileDiff;
    const shouldShowInlineGitDiff = Boolean(
      editor
      && inlineGitDiffEnabled
      && activeTabId
      && !activeTabId.startsWith('untitled')
      && isDocumentReady
      && !hasLoadError
      && !isWorkspaceDirty
      && isInlineGitDiffPathState(gitPathState)
    );

    if (!shouldShowInlineGitDiff || (gitPathState === 'modified' && !getFileDiff)) {
      clearInlineGitDiff();
      return;
    }

    if (gitStatus.isLoading) {
      return;
    }

    const requestId = inlineGitDiffRequestRef.current + 1;
    inlineGitDiffRequestRef.current = requestId;
    inlineGitDiffAppliedContentRef.current = null;
    inlineGitDiffControllerRef.current?.clear();
    handleInlineGitDiffSummaryChange(null);

    let cancelled = false;

    const applyInlineGitDiffPayload = (payload: { filePath: string; originalContent: string; currentContent: string }) => {
      if (cancelled || inlineGitDiffRequestRef.current !== requestId) {
        return;
      }

      const editorContent = editor?.getModel?.()?.getValue?.() ?? codeRef.current;
      if (normalizeEditorContentForInlineDiff(editorContent) !== normalizeEditorContentForInlineDiff(payload.currentContent)) {
        inlineGitDiffControllerRef.current?.clear();
        inlineGitDiffAppliedContentRef.current = null;
        handleInlineGitDiffSummaryChange(null);
        return;
      }

      const diff = computeInlineGitDiff(payload.originalContent, payload.currentContent);
      inlineGitDiffControllerRef.current?.apply(diff);
      inlineGitDiffAppliedContentRef.current = payload.currentContent;
      handleInlineGitDiffSummaryChange(diff.changedLineCount > 0
        ? {
          filePath: payload.filePath,
          ...getInlineGitDiffLineCounts(diff),
        }
        : null);
    };

    if (gitPathState === 'created') {
      const currentContent = editor?.getModel?.()?.getValue?.() ?? codeRef.current;
      applyInlineGitDiffPayload({
        filePath: activeTabId,
        originalContent: '',
        currentContent,
      });

      return () => {
        cancelled = true;
      };
    }

    void getFileDiff?.(activeTabId)
      .then(applyInlineGitDiffPayload)
      .catch(() => {
        if (!cancelled && inlineGitDiffRequestRef.current === requestId) {
          inlineGitDiffControllerRef.current?.clear();
          inlineGitDiffAppliedContentRef.current = null;
          handleInlineGitDiffSummaryChange(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTabId, gitPathState, gitStatus.isLoading, hasLoadError, inlineGitDiffEnabled, isDocumentReady, isWorkspaceDirty, mountedEditor]);

  useEffect(() => {
    canPropagateCursorChangesRef.current = false;
  }, [activeTabId]);

  useRegisterEditorLanguages(monaco);

  useEffect(() => {
    applyEditorLayoutRef.current({ force: true });

    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      applyEditorLayoutRef.current();
    });

    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    applyEditorLayoutRef.current({ force: true });
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
    inlineGitDiffControllerRef.current?.syncEditorFont();
    applyEditorLayoutRef.current({ force: true });
  }, [editorBehaviorOptions, editorRef]);

  useEffect(() => {
    monaco?.editor.remeasureFonts?.();
  }, [editorFontFamily, editorOptions, monaco]);

  useEffect(() => {
    if (!monaco) {
      return;
    }

    defineMonacoTheme(monaco, activeTheme);
  }, [activeTheme, monaco]);

  useEffect(() => {
    if (!activeTabId || !mountedEditor) {
      return;
    }

    handleActiveModelReady(activeTabId);
    applyEditorLayoutRef.current({ force: true });
  }, [activeTabId, mountedEditor]);

  return (
    <div
      ref={hostRef}
      className="relative flex-1 overflow-hidden bg-background"
      onKeyDownCapture={handlePlainSpaceKeyDownCapture}
    >
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
        theme={themeId}
        beforeMount={(nextMonaco) => {
          monacoInstanceRef.current = nextMonaco;
          registerBuiltInMonacoThemes(nextMonaco);
          defineMonacoTheme(nextMonaco, activeTheme);
        }}
        onMount={(editor) => {
          const activeMonaco = monacoInstanceRef.current;

          editorRef.current = editor;
          setMountedEditor(editor);
          if (activeTabId) {
            handleActiveModelReady(activeTabId);
          }
          applyEditorLayoutRef.current({ force: true });
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
          if (
            onNewShortcut
            && typeof editor.addCommand === 'function'
            && typeof activeMonaco?.KeyMod?.CtrlCmd === 'number'
            && typeof activeMonaco?.KeyCode?.KeyN === 'number'
          ) {
            editor.addCommand(activeMonaco.KeyMod.CtrlCmd | activeMonaco.KeyCode.KeyN, () => {
              handleNewShortcut();
            });
          }
          if (
            onCloseShortcut
            && typeof editor.addCommand === 'function'
            && typeof activeMonaco?.KeyMod?.CtrlCmd === 'number'
            && typeof activeMonaco?.KeyCode?.KeyW === 'number'
          ) {
            editor.addCommand(activeMonaco.KeyMod.CtrlCmd | activeMonaco.KeyCode.KeyW, () => {
              handleCloseShortcut();
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