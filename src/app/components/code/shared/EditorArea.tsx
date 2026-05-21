import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import {
  X, ChevronRight, Split,
  MoreHorizontal, Circle,
} from 'lucide-react';
import type { WorkspaceGitPathState } from '../../../../../types/workspace-git';
import { getWorkspaceGitPathState, useWorkspaceGitStatus } from '../../../git/workspaceGitStatus';
import { getDisplayPathSegments } from '../../../workspace/workspaceFiles';
import { FileTypeBadge } from './FileTypeBadge';
import { useEditorDocumentState } from './useEditorDocumentState';
import {
  getEditorTabDocumentId,
  getEditorTabSourceFileId,
  isGitDiffEditorTab,
  type EditorTab as WorkspaceEditorTab,
  type SplitDirection,
} from '../../../editor/editorLayout';
import { focusEditorInstance } from '../../../editor/focusEditor';
import type { CursorRestoreRequest } from '../../../context/useWorkspaceEditorState';
import { EmptyProject } from './EmptyProject';
import { TooltipIconButton } from '../../ui/tooltip-icon-button';
import { useCodeViewerLayout, type CodeViewerLayoutMode } from '../../../context/CodeViewerLayoutContext';
import { getEditorAreaRootClassName, getEditorTabBarClassName, getEditorTabClassName } from './codeViewerLayoutStyles';

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

function loadMonacoGitDiffPane() {
  return import('./MonacoGitDiffPane');
}

const MonacoEditorPane = lazy(() => loadMonacoEditorPane().then((module) => ({ default: module.MonacoEditorPane })));
const MonacoGitDiffPane = lazy(() => loadMonacoGitDiffPane().then((module) => ({ default: module.MonacoGitDiffPane })));

interface EditorAreaTab extends Omit<WorkspaceEditorTab, 'isPinned'> {
  isPinned?: boolean;
}

function toWorkspaceEditorTab(tab: EditorAreaTab | undefined): WorkspaceEditorTab | undefined {
  return tab ? { ...tab, isPinned: tab.isPinned ?? true } : undefined;
}

interface EditorAreaProps {
  tabs: EditorAreaTab[];
  activeTabId: string;
  documentTabId?: string;
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
  onNewShortcut?: () => void;
  onCloseShortcut?: () => void;
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
      className="flex-1 overflow-auto bg-ide-editor-bg px-4 py-3 font-mono text-[12px] text-ide-text-muted whitespace-pre"
    >
      {text}
    </div>
  );
}

function PreviewTabIndicator({ tabId }: { tabId: string }) {
  return (
    <span
      data-testid={`editor-tab-preview-indicator-${tabId}`}
      className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full text-ide-accent"
      title="Preview tab"
    >
      <span
        aria-hidden="true"
        data-testid={`editor-tab-preview-indicator-ring-${tabId}`}
        className="absolute inset-0 rounded-full border border-current/80"
      />
      <span
        aria-hidden="true"
        data-testid={`editor-tab-preview-indicator-dot-${tabId}`}
        className="h-1.5 w-1.5 rounded-full bg-current"
      />
    </span>
  );
}

// ─── Tab Component ─────────────────────────────────────────────────────────────
function EditorTab({
  tab, isActive, gitState, layoutMode, onActivate, onClose, onPin, onDragStart, onDragEnd,
}: {
  tab: EditorAreaTab;
  isActive: boolean;
  gitState?: WorkspaceGitPathState;
  layoutMode: CodeViewerLayoutMode;
  onActivate: () => void;
  onClose: () => void;
  onPin?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const isPreview = tab.isPinned === false;
  const workspaceTab = toWorkspaceEditorTab(tab);
  const tabDocumentId = getEditorTabDocumentId(workspaceTab);
  const isGitDiff = isGitDiffEditorTab(workspaceTab);
  const tooltipText = isGitDiff
    ? `${tabDocumentId} (Git diff)`
    : isPreview
    ? `${tab.id} (Preview tab)`
    : tab.id;
  const trailingControlClassName = isPreview && !tab.modified
    ? 'opacity-50 hover:opacity-100'
    : 'opacity-0 group-hover:opacity-100';
  const tabTitleToneClassName = gitState === 'modified'
    ? 'text-ide-warning'
    : gitState === 'ignored'
    ? 'text-ide-text-muted'
    : isPreview
    ? 'text-ide-text'
    : '';

  return (
    <div
      draggable={Boolean(onDragStart)}
      data-testid={`editor-tab-${tab.id}`}
      data-active={isActive ? 'true' : 'false'}
      title={tooltipText}
      className={getEditorTabClassName(layoutMode, isActive)}
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
      <div
        data-testid={`editor-tab-primary-${tab.id}`}
        className="flex min-w-0 flex-1 items-center gap-1"
      >
        <FileTypeBadge
          name={tab.name}
          path={tabDocumentId}
          testId={`editor-tab-badge-${tab.id}`}
          className="h-4 w-4"
        />
        <span
          data-testid={`editor-tab-title-${tab.id}`}
          className={`min-w-0 flex-1 truncate text-[12px] leading-4 ${isPreview ? 'italic' : ''} ${tabTitleToneClassName}`}
        >
          {tab.name}
        </span>
      </div>
      {tab.modified && (
        <div className="relative flex h-3 w-3 shrink-0 items-center justify-center">
          <Circle
            size={7}
            data-testid={`editor-tab-dirty-indicator-${tab.id}`}
            className="fill-ide-text text-ide-text shrink-0 transition-opacity group-hover:opacity-0"
          />
          <button
            data-testid={`editor-tab-close-${tab.id}`}
            className="absolute inset-0 flex items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-ide-border"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            <X size={12} />
          </button>
        </div>
      )}
      {!tab.modified && isPreview && (
        <PreviewTabIndicator tabId={tab.id} />
      )}
      {!tab.modified && (
        <button
          data-testid={`editor-tab-close-${tab.id}`}
          className={`shrink-0 p-0.5 rounded hover:bg-ide-border transition-opacity ${trailingControlClassName}`}
          onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
function Breadcrumb({ segments }: { segments: string[] }) {
  return (
    <div data-testid="editor-breadcrumb" className="flex items-center gap-0.5 px-3 h-6 bg-ide-editor-bg border-b border-ide-border shrink-0">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <ChevronRight size={11} className="text-ide-text-muted/50" />}
          <span
            data-testid={`editor-breadcrumb-segment-${i}`}
            className={`cursor-pointer hover:text-ide-text transition-colors ${
              i === segments.length - 1 ? 'text-ide-text' : 'text-ide-text-muted'
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
  documentTabId,
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
  onNewShortcut,
  onCloseShortcut,
  onSaveShortcut,
  onContentChange,
  onEditorMount,
  onNavigateToLocation,
  showDragInteractionShield,
  dragInteractionShieldTestId,
}: EditorAreaProps) {
  const { layoutMode } = useCodeViewerLayout();
  const activeEditorTab = tabs.find((tab) => tab.id === activeTabId);
  const activeWorkspaceTab = toWorkspaceEditorTab(activeEditorTab);
  const isActiveGitDiffTab = isGitDiffEditorTab(activeWorkspaceTab);
  const resolvedActiveDocumentId = isActiveGitDiffTab
    ? getEditorTabDocumentId(activeWorkspaceTab)
    : documentTabId ?? activeTabId;
  const lastAppliedRestoreRef = useRef({ activeTabId: '', restoreToken: 0 });
  const [activeModelReadyId, setActiveModelReadyId] = useState('');
  const gitStatus = useWorkspaceGitStatus();
  const {
    activeLoadError,
    code,
    isActiveTabReady,
    placeholderText,
    updateContent,
  } = useEditorDocumentState({
    tabs,
    activeTabId,
    documentTabId: isActiveGitDiffTab ? '' : resolvedActiveDocumentId,
    contentCache,
    loadingFiles,
    loadErrors,
    onLoadFile,
    onContentChange,
  });
  const breadcrumbSegments = activeEditorTab ? getDisplayPathSegments(resolvedActiveDocumentId || activeTabId, activeEditorTab.name) : [];

  // Jump to line
  useEffect(() => {
    if (isActiveGitDiffTab || !jumpToLine || !editorRef.current || !isActiveTabReady || activeModelReadyId !== resolvedActiveDocumentId) {
      return;
    }

    const editor = editorRef.current;

    if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
      const frameId = window.requestAnimationFrame(() => {
        editor.revealLineInCenter(jumpToLine);
        editor.setPosition({ lineNumber: jumpToLine, column: 1 });
        focusEditorInstance(editor);
        onCursorChange?.(jumpToLine, 1);
        lastAppliedRestoreRef.current = { activeTabId: resolvedActiveDocumentId, restoreToken: 0 };
      });

      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    editor.revealLineInCenter(jumpToLine);
    editor.setPosition({ lineNumber: jumpToLine, column: 1 });
    focusEditorInstance(editor);
    onCursorChange?.(jumpToLine, 1);
    lastAppliedRestoreRef.current = { activeTabId: resolvedActiveDocumentId, restoreToken: 0 };
  }, [activeModelReadyId, resolvedActiveDocumentId, isActiveGitDiffTab, isActiveTabReady, jumpToLine, editorRef, onCursorChange]);

  useEffect(() => {
    if (isActiveGitDiffTab) {
      return;
    }

    const editor = editorRef.current;
    const activeRestoreRequest = cursorRestoreRequest && (
      cursorRestoreRequest.fileId === activeTabId || cursorRestoreRequest.fileId === resolvedActiveDocumentId
    ) ? cursorRestoreRequest : undefined;
    const restoreToken = activeRestoreRequest?.token ?? 0;

    if (!focused || !resolvedActiveDocumentId || !isActiveTabReady || activeModelReadyId !== resolvedActiveDocumentId || !editor || jumpToLine) {
      return;
    }

    const lastAppliedRestore = lastAppliedRestoreRef.current;
    const needsRestore = lastAppliedRestore.activeTabId !== resolvedActiveDocumentId || lastAppliedRestore.restoreToken !== restoreToken;
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
        activeTabId: resolvedActiveDocumentId,
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
    isActiveGitDiffTab,
    jumpToLine,
    onCursorChange,
    onCursorRestoreRequestConsumed,
    resolvedActiveDocumentId,
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
    <div className={getEditorAreaRootClassName(layoutMode)} onMouseDown={() => onFocus?.()}>
      {/* Tab bar */}
      <div data-testid="editor-tab-bar" data-code-viewer-layout-mode={layoutMode} className={getEditorTabBarClassName(layoutMode)}>
        {tabs.map((tab) => (
          <EditorTab
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            gitState={getWorkspaceGitPathState(gitStatus, getEditorTabSourceFileId(toWorkspaceEditorTab(tab)))}
            layoutMode={layoutMode}
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
            className="px-1 text-ide-text-muted hover:bg-ide-hover hover:text-ide-text transition-colors shrink-0 cursor-pointer"
          >
            <Split size={14} />
          </button>
        </TooltipIconButton>
        <TooltipIconButton content="Split Editor Down">
          <button
            data-testid="editor-split-down"
            aria-label="Split Editor Down"
            onClick={() => onSplitEditor?.('vertical')}
            className="px-1 text-ide-text-muted hover:bg-ide-hover hover:text-ide-text transition-colors shrink-0 cursor-pointer"
          >
            <Split size={14} className="rotate-90" />
          </button>
        </TooltipIconButton>
        <button className="px-2 text-ide-text-muted hover:text-ide-text transition-colors shrink-0 cursor-pointer">
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Breadcrumb */}
      {activeEditorTab && <Breadcrumb segments={breadcrumbSegments} />}

      {isActiveGitDiffTab && resolvedActiveDocumentId ? (
        <Suspense
          fallback={(
            <div className="flex flex-1 items-center justify-center bg-ide-editor-bg text-ide-text-muted text-[12px]">
              Loading editor...
            </div>
          )}
        >
          <MonacoGitDiffPane
            filePath={resolvedActiveDocumentId}
            onEditorMount={onEditorMount}
            showDragInteractionShield={showDragInteractionShield}
            dragInteractionShieldTestId={dragInteractionShieldTestId}
          />
        </Suspense>
      ) : !isActiveTabReady ? (
        <EditorDocumentPlaceholder text={placeholderText} />
      ) : (
        <Suspense
          fallback={(
            <div className="flex flex-1 items-center justify-center bg-ide-editor-bg text-ide-text-muted text-[12px]">
              Loading editor...
            </div>
          )}
        >
          <MonacoEditorPane
            activeTabId={resolvedActiveDocumentId}
            code={code}
            editorRef={editorRef}
            onActiveModelReady={setActiveModelReadyId}
            onCursorChange={onCursorChange}
            onCloseShortcut={onCloseShortcut}
            onSaveShortcut={onSaveShortcut}
            onNewShortcut={onNewShortcut}
            onContentChange={updateContent}
            onEditorMount={onEditorMount}
            onNavigateToLocation={onNavigateToLocation}
            isDocumentReady={isActiveTabReady}
            hasLoadError={Boolean(activeLoadError)}
            isWorkspaceDirty={Boolean(activeEditorTab?.modified)}
            showDragInteractionShield={showDragInteractionShield}
            dragInteractionShieldTestId={dragInteractionShieldTestId}
          />
        </Suspense>
      )}
    </div>
  );
}
