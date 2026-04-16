import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import {
  X, ChevronRight, Split,
  MoreHorizontal, Circle,
} from 'lucide-react';
import type { WorkspaceGitPathState } from '../../../../../types/workspace-git';
import { getWorkspaceGitPathState, useWorkspaceGitStatus } from '../../../git/workspaceGitStatus';
import { getWorkspaceSegments } from '../../../workspace/workspaceFiles';
import { FileTypeBadge } from './FileTypeBadge';
import { useEditorDocumentState } from './useEditorDocumentState';
import type { SplitDirection } from '../../../editor/editorLayout';
import { focusEditorInstance } from '../../../editor/focusEditor';
import type { CursorRestoreRequest } from '../../../context/useWorkspaceEditorState';
import { EmptyProject } from './EmptyProject';
import { TooltipIconButton } from '../../ui/tooltip-icon-button';

function clampEditorPosition(editor: any, line: number, col: number) {
  const model = editor?.getModel?.();
  if (!model) {
    return {
      lineNumber: Math.max(line, 1),
      column: Math.max(col, 1),
    };
  }

  const safeLine = Math.min(Math.max(line, 1), model.getLineCount?.() ?? Math.max(line, 1));
  const safeColumn = Math.min(
    Math.max(col, 1),
    model.getLineMaxColumn?.(safeLine) ?? Math.max(col, 1),
  );

  return {
    lineNumber: safeLine,
    column: safeColumn,
  };
}

function loadMonacoEditorPane() {
  return import('./MonacoEditorPane');
}

const MonacoEditorPane = lazy(() => loadMonacoEditorPane().then((module) => ({ default: module.MonacoEditorPane })));

interface Tab {
  id: string;
  name: string;
  modified?: boolean;
  isPinned?: boolean;
}

interface EditorAreaProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (id: string) => void;
  onTabClose: (id: string) => void;
  onTabPin?: (id: string) => void;
  editorRef: React.MutableRefObject<any>;
  jumpToLine?: number;
  onCursorChange?: (line: number, col: number) => void;
  cursorPosition?: { line: number; col: number };
  cursorRestoreRequest?: CursorRestoreRequest;
  onCursorRestoreRequestConsumed?: (token: number) => void;
  onSplitEditor?: (direction: SplitDirection) => void;
  onFocus?: () => void;
  focused?: boolean;
  onTabDragStart?: (tabId: string) => void;
  onTabDragEnd?: () => void;
  contentCache?: Record<string, string>;
  loadingFiles?: Record<string, boolean>;
  loadErrors?: Record<string, string>;
  onLoadFile?: (fileId: string) => void;
  onSaveShortcut?: () => void;
  onContentChange?: (fileId: string, content: string) => void;
  onEditorMount?: (editor: any) => void;
  onNavigateToLocation?: (fileId: string, line: number, col: number) => void;
  showDragInteractionShield?: boolean;
  dragInteractionShieldTestId?: string;
}

function EditorDocumentPlaceholder({ text }: { text: string }) {
  return (
    <div
      data-testid="editor-document-placeholder"
      className="flex-1 overflow-auto bg-background px-4 py-3 font-mono text-[12px] text-muted-foreground whitespace-pre"
    >
      {text}
    </div>
  );
}

// ─── Tab Component ─────────────────────────────────────────────────────────────
function EditorTab({
  tab, isActive, gitState, onActivate, onClose, onPin, onDragStart, onDragEnd,
}: {
  tab: Tab;
  isActive: boolean;
  gitState?: WorkspaceGitPathState;
  onActivate: () => void;
  onClose: () => void;
  onPin?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const isPreview = tab.isPinned === false;
  const tooltipText = isPreview ? `${tab.id} (Preview tab)` : tab.id;
  const trailingControlClassName = isPreview && !tab.modified
    ? 'opacity-50 hover:opacity-100'
    : 'opacity-0 group-hover:opacity-100';
  const tabTitleToneClassName = gitState === 'modified'
    ? 'text-ide-warning'
    : gitState === 'ignored'
    ? 'text-ide-text-muted'
    : isPreview
    ? 'text-foreground'
    : '';

  return (
    <div
      draggable={Boolean(onDragStart)}
      data-testid={`editor-tab-${tab.id}`}
      title={tooltipText}
      className={`flex items-center gap-1 px-3 h-full cursor-pointer group border-r border-border transition-colors shrink-0 min-w-[100px] max-w-[200px] ${
        isActive
          ? 'bg-background text-foreground border-t-2 border-t-primary'
          : 'bg-muted text-muted-foreground hover:bg-muted/80 border-t-2 border-t-transparent'
      }`}
      onClick={onActivate}
      onDoubleClick={() => {
        onActivate();
        if (isPreview) {
          onPin?.();
        }
      }}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        if (isPreview) {
          onPin?.();
        }
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
    >
      <FileTypeBadge
        name={tab.name}
        testId={`editor-tab-badge-${tab.id}`}
        className="shrink-0 text-[10px] font-bold font-mono"
        fallbackClassName="text-foreground"
      />
      <span
        data-testid={`editor-tab-title-${tab.id}`}
        className={`flex-1 truncate text-[12px] ${isPreview ? 'italic' : ''} ${tabTitleToneClassName}`}
      >
        {tab.name}
      </span>
      {tab.modified && (
        <div className="relative flex h-3 w-3 shrink-0 items-center justify-center">
          <Circle
            size={7}
            data-testid={`editor-tab-dirty-indicator-${tab.id}`}
            className="fill-foreground text-foreground shrink-0 transition-opacity group-hover:opacity-0"
          />
          <button
            data-testid={`editor-tab-close-${tab.id}`}
            className="absolute inset-0 flex items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-border"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            <X size={12} />
          </button>
        </div>
      )}
      {!tab.modified && isPreview && (
        <span
          data-testid={`editor-tab-preview-indicator-${tab.id}`}
          className="h-2 w-2 shrink-0 rounded-full border border-primary/80 bg-transparent"
          title="Preview tab"
        />
      )}
      {!tab.modified && (
        <button
          data-testid={`editor-tab-close-${tab.id}`}
          className={`shrink-0 p-0.5 rounded hover:bg-border transition-opacity ${trailingControlClassName}`}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
function Breadcrumb({ filePath }: { filePath: string }) {
  const segments = getWorkspaceSegments(filePath);

  return (
    <div className="flex items-center gap-0.5 px-3 h-6 bg-background border-b border-border shrink-0">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <ChevronRight size={11} className="text-muted-foreground/50" />}
          <span
            className={`cursor-pointer hover:text-foreground transition-colors ${
              i === segments.length - 1 ? 'text-foreground' : 'text-muted-foreground'
            } text-[12px]`}
          >
            {seg}
          </span>
        </span>
      ))}
    </div>
  );
}

// ─── Editor Area Component ─────────────────────────────────────────────────────
export function EditorArea({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onTabPin,
  editorRef,
  jumpToLine,
  onCursorChange,
  cursorPosition,
  cursorRestoreRequest,
  onCursorRestoreRequestConsumed,
  onSplitEditor,
  onFocus,
  focused = true,
  onTabDragStart,
  onTabDragEnd,
  contentCache,
  loadingFiles,
  loadErrors,
  onLoadFile,
  onSaveShortcut,
  onContentChange,
  onEditorMount,
  onNavigateToLocation,
  showDragInteractionShield,
  dragInteractionShieldTestId,
}: EditorAreaProps) {
  const lastAppliedRestoreRef = useRef({ activeTabId: '', restoreToken: 0 });
  const [activeModelReadyId, setActiveModelReadyId] = useState('');
  const gitStatus = useWorkspaceGitStatus();
  const {
    activeLoadError,
    activeTab,
    code,
    isActiveTabReady,
    placeholderText,
    updateContent,
  } = useEditorDocumentState({
    tabs,
    activeTabId,
    contentCache,
    loadingFiles,
    loadErrors,
    onLoadFile,
    onContentChange,
  });

  // Jump to line
  useEffect(() => {
    if (!jumpToLine || !editorRef.current || !isActiveTabReady || activeModelReadyId !== activeTabId) {
      return;
    }

    const editor = editorRef.current;

    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      const frameId = window.requestAnimationFrame(() => {
        editor.revealLineInCenter(jumpToLine);
        editor.setPosition({ lineNumber: jumpToLine, column: 1 });
        focusEditorInstance(editor);
        onCursorChange?.(jumpToLine, 1);
        lastAppliedRestoreRef.current = { activeTabId, restoreToken: 0 };
      });

      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    editor.revealLineInCenter(jumpToLine);
    editor.setPosition({ lineNumber: jumpToLine, column: 1 });
    focusEditorInstance(editor);
    onCursorChange?.(jumpToLine, 1);
    lastAppliedRestoreRef.current = { activeTabId, restoreToken: 0 };
  }, [activeModelReadyId, activeTabId, isActiveTabReady, jumpToLine, editorRef, onCursorChange]);

  useEffect(() => {
    const editor = editorRef.current;
    const activeRestoreRequest = cursorRestoreRequest?.fileId === activeTabId ? cursorRestoreRequest : undefined;
    const restoreToken = activeRestoreRequest?.token ?? 0;

    if (!focused || !activeTabId || !isActiveTabReady || activeModelReadyId !== activeTabId || !editor || jumpToLine) {
      return;
    }

    const lastAppliedRestore = lastAppliedRestoreRef.current;
    const needsRestore = lastAppliedRestore.activeTabId !== activeTabId || lastAppliedRestore.restoreToken !== restoreToken;
    if (!needsRestore) {
      return;
    }

    const applyRestore = () => {
      const currentEditor = editorRef.current;
      if (!currentEditor) {
        return;
      }

      const targetPosition = activeRestoreRequest ?? cursorPosition ?? { line: 1, col: 1 };
      const nextPosition = clampEditorPosition(currentEditor, targetPosition.line, targetPosition.col);

      currentEditor.setPosition(nextPosition);
      currentEditor.revealPositionInCenter?.(nextPosition);
      if (!currentEditor.revealPositionInCenter) {
        currentEditor.revealLineInCenter?.(nextPosition.lineNumber);
      }
      focusEditorInstance(currentEditor);
      onCursorChange?.(nextPosition.lineNumber, nextPosition.column);

      lastAppliedRestoreRef.current = {
        activeTabId,
        restoreToken: activeRestoreRequest ? 0 : restoreToken,
      };

      if (activeRestoreRequest) {
        onCursorRestoreRequestConsumed?.(activeRestoreRequest.token);
      }
    };

    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      const frameId = window.requestAnimationFrame(applyRestore);

      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    applyRestore();
  }, [
    activeTabId,
    cursorPosition?.col,
    cursorPosition?.line,
    cursorRestoreRequest,
    editorRef,
    focused,
    activeModelReadyId,
    isActiveTabReady,
    jumpToLine,
    onCursorChange,
    onCursorRestoreRequestConsumed,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if ('requestIdleCallback' in window) {
      const idleCallbackId = window.requestIdleCallback(() => {
        void loadMonacoEditorPane();
      });

      return () => {
        window.cancelIdleCallback(idleCallbackId);
      };
    }

    const timeoutId = globalThis.setTimeout(() => {
      void loadMonacoEditorPane();
    }, 150);

    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, []);

  if (tabs.length === 0) {
    return (
      <EmptyProject></EmptyProject>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden" onMouseDown={() => onFocus?.()}>
      {/* Tab bar */}
      <div data-testid="editor-tab-bar" className="flex items-stretch h-[27px] bg-muted overflow-x-auto shrink-0 border-b border-border">
        {tabs.map((tab) => (
          <EditorTab
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            gitState={getWorkspaceGitPathState(gitStatus, tab.id)}
            onActivate={() => onTabChange(tab.id)}
            onClose={() => onTabClose(tab.id)}
            onPin={onTabPin ? () => onTabPin(tab.id) : undefined}
            onDragStart={onTabDragStart ? () => onTabDragStart(tab.id) : undefined}
            onDragEnd={onTabDragEnd}
          />
        ))}
        <div className="flex-1" />
        <TooltipIconButton content="Split Editor Right">
          <button
            data-testid="editor-split-right"
            aria-label="Split Editor Right"
            onClick={() => onSplitEditor?.('horizontal')}
            className="px-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0 cursor-pointer"
          >
            <Split size={14} />
          </button>
        </TooltipIconButton>
        <TooltipIconButton content="Split Editor Down">
          <button
            data-testid="editor-split-down"
            aria-label="Split Editor Down"
            onClick={() => onSplitEditor?.('vertical')}
            className="px-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0 cursor-pointer"
          >
            <Split size={14} className="rotate-90" />
          </button>
        </TooltipIconButton>
        <button className="px-2 text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer">
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Breadcrumb */}
      {activeTab && <Breadcrumb filePath={activeTabId} />}

      {!isActiveTabReady ? (
        <EditorDocumentPlaceholder text={placeholderText} />
      ) : (
        <Suspense
          fallback={(
            <div className="flex flex-1 items-center justify-center bg-background text-muted-foreground text-[12px]">
              Loading editor...
            </div>
          )}
        >
          <MonacoEditorPane
            activeTabId={activeTabId}
            code={code}
            editorRef={editorRef}
            onActiveModelReady={setActiveModelReadyId}
            onCursorChange={onCursorChange}
            onSaveShortcut={onSaveShortcut}
            onContentChange={updateContent}
            onEditorMount={onEditorMount}
            onNavigateToLocation={onNavigateToLocation}
            isDocumentReady={isActiveTabReady}
            hasLoadError={Boolean(activeLoadError)}
            showDragInteractionShield={showDragInteractionShield}
            dragInteractionShieldTestId={dragInteractionShieldTestId}
          />
        </Suspense>
      )}
    </div>
  );
}