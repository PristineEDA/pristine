import { DiffEditor, useMonaco } from '@monaco-editor/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import '../../../editor/configureMonacoLoader';
import { useRegisterEditorLanguages } from '../../../editor/registerLanguages';
import { getEditorLanguage } from '../../../workspace/workspaceFiles';
import { useTheme } from '../../../context/ThemeContext';
import { defineMonacoTheme, registerBuiltInMonacoThemes } from '../../../theme/monacoColorTheme';
import { useMonacoEditorOptions } from './useMonacoEditorOptions';

interface EditorViewport {
  width: number;
  height: number;
}

interface ReadyDiffState {
  status: 'ready';
  originalContent: string;
  currentContent: string;
}

interface LoadingDiffState {
  status: 'loading';
}

interface ErrorDiffState {
  status: 'error';
  message: string;
}

type GitDiffState = LoadingDiffState | ReadyDiffState | ErrorDiffState;

interface MonacoGitDiffPaneProps {
  filePath: string;
  onEditorMount?: (editor: any) => void;
  showDragInteractionShield?: boolean;
  dragInteractionShieldTestId?: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to load git diff';
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

export function MonacoGitDiffPane({
  filePath,
  onEditorMount,
  showDragInteractionShield,
  dragInteractionShieldTestId,
}: MonacoGitDiffPaneProps) {
  const monaco = useMonaco();
  const { activeTheme, themeId } = useTheme();
  const { editorFontFamily, editorOptions } = useMonacoEditorOptions();
  const editorLanguage = getEditorLanguage(filePath);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const diffEditorRef = useRef<any>(null);
  const monacoInstanceRef = useRef(monaco);
  const lastLayoutViewportRef = useRef<EditorViewport | null>(null);
  const [diffState, setDiffState] = useState<GitDiffState>({ status: 'loading' });
  const diffOptions = useMemo(() => ({
    ...editorOptions,
    readOnly: true,
    originalEditable: false,
    renderSideBySide: true,
    ignoreTrimWhitespace: false,
  }), [editorOptions]);

  const applyEditorLayoutRef = useRef<(options?: { force?: boolean }) => void>(() => undefined);
  applyEditorLayoutRef.current = ({ force = false }: { force?: boolean } = {}) => {
    const editor = diffEditorRef.current;
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

  useRegisterEditorLanguages(monaco);

  useEffect(() => {
    monacoInstanceRef.current = monaco;
  }, [monaco]);

  useEffect(() => {
    if (!monaco) {
      return;
    }

    defineMonacoTheme(monaco, activeTheme);
  }, [activeTheme, monaco]);

  useEffect(() => {
    monaco?.editor.remeasureFonts?.();
  }, [editorFontFamily, monaco]);

  useEffect(() => {
    let isCurrent = true;
    const gitApi = window.electronAPI?.git;

    setDiffState({ status: 'loading' });

    if (!gitApi?.getFileDiff) {
      setDiffState({ status: 'error', message: 'Git API unavailable' });
      return () => {
        isCurrent = false;
      };
    }

    void gitApi.getFileDiff(filePath)
      .then((payload) => {
        if (!isCurrent) {
          return;
        }

        setDiffState({
          status: 'ready',
          originalContent: payload.originalContent,
          currentContent: payload.currentContent,
        });
      })
      .catch((error: unknown) => {
        if (!isCurrent) {
          return;
        }

        setDiffState({ status: 'error', message: getErrorMessage(error) });
      });

    return () => {
      isCurrent = false;
    };
  }, [filePath]);

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
  }, [showDragInteractionShield, diffState.status]);

  return (
    <div
      ref={hostRef}
      data-testid="monaco-git-diff-pane"
      data-file-path={filePath}
      className="relative flex-1 overflow-hidden bg-background"
    >
      {showDragInteractionShield && (
        <div
          data-testid={dragInteractionShieldTestId}
          className="absolute inset-0 z-10 cursor-grabbing bg-transparent"
          aria-hidden="true"
        />
      )}
      {diffState.status === 'loading' && (
        <div data-testid="monaco-git-diff-loading" className="flex h-full items-center justify-center bg-ide-editor-bg text-[12px] text-ide-text-muted">
          Loading git diff...
        </div>
      )}
      {diffState.status === 'error' && (
        <div data-testid="monaco-git-diff-error" className="h-full overflow-auto bg-ide-editor-bg px-4 py-3 font-mono text-[12px] text-ide-text-muted whitespace-pre-wrap">
          {`Unable to load git diff for ${filePath}\n${diffState.message}`}
        </div>
      )}
      {diffState.status === 'ready' && (
        <DiffEditor
          height="100%"
          language={editorLanguage}
          original={diffState.originalContent}
          modified={diffState.currentContent}
          originalModelPath={`git-head://${filePath}`}
          modifiedModelPath={`workspace://${filePath}`}
          theme={themeId}
          beforeMount={(nextMonaco) => {
            monacoInstanceRef.current = nextMonaco;
            registerBuiltInMonacoThemes(nextMonaco);
            defineMonacoTheme(nextMonaco, activeTheme);
          }}
          onMount={(editor) => {
            diffEditorRef.current = editor;
            const modifiedEditor = editor.getModifiedEditor?.() ?? editor;
            onEditorMount?.(modifiedEditor);
            applyEditorLayoutRef.current({ force: true });
          }}
          options={diffOptions}
        />
      )}
    </div>
  );
}
