import { Suspense, lazy, useEffect } from 'react';
import {
  X, ChevronRight, Split,
  MoreHorizontal, Circle,
} from 'lucide-react';
import { getWorkspaceSegments } from '../workspace/workspaceFiles';
import { FileTypeBadge } from './FileTypeBadge';
import { useEditorDocumentState } from './useEditorDocumentState';
import type { SplitDirection } from '../editor/editorLayout';

const MonacoEditorPane = lazy(() => import('./MonacoEditorPane').then((module) => ({ default: module.MonacoEditorPane })));

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
  onSplitEditor?: (direction: SplitDirection) => void;
  onFocus?: () => void;
  onTabDragStart?: (tabId: string) => void;
  onTabDragEnd?: () => void;
  contentCache?: Record<string, string>;
  loadingFiles?: Record<string, boolean>;
  loadErrors?: Record<string, string>;
  onLoadFile?: (fileId: string) => void;
  onContentChange?: (fileId: string, content: string) => void;
  onEditorMount?: (editor: any) => void;
  showDragInteractionShield?: boolean;
  dragInteractionShieldTestId?: string;
}

// ─── Tab Component ─────────────────────────────────────────────────────────────
function EditorTab({
  tab, isActive, onActivate, onClose, onPin, onDragStart, onDragEnd,
}: {
  tab: Tab;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  onPin?: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const isPreview = tab.isPinned === false;
  const tooltipText = isPreview ? `${tab.id} (Preview tab)` : tab.id;

  return (
    <div
      draggable={Boolean(onDragStart)}
      data-testid={`editor-tab-${tab.id}`}
      title={tooltipText}
      className={`flex items-center gap-1 px-3 h-full cursor-pointer group border-r border-ide-sidebar-bg transition-colors shrink-0 min-w-[100px] max-w-[200px] ${
        isActive
          ? 'bg-ide-bg text-white border-t-2 border-t-ide-accent'
          : 'bg-ide-tab-bg text-ide-text-muted hover:bg-ide-tab-hover border-t-2 border-t-transparent'
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
        fallbackClassName="text-ide-text"
      />
      <span
        data-testid={`editor-tab-title-${tab.id}`}
        className={`flex-1 truncate text-[12px] ${isPreview ? 'italic text-ide-text' : ''}`}
      >
        {tab.name}
      </span>
      {tab.modified && <Circle size={7} className="fill-white text-white shrink-0" />}
      {!tab.modified && isPreview && (
        <span
          data-testid={`editor-tab-preview-indicator-${tab.id}`}
          className="h-2 w-2 shrink-0 rounded-full border border-ide-accent-vivid/80 bg-transparent"
          title="Preview tab"
        />
      )}
      <button
        data-testid={`editor-tab-close-${tab.id}`}
        className={`shrink-0 p-0.5 rounded hover:bg-ide-border transition-opacity ${isPreview ? 'opacity-50 hover:opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
function Breadcrumb({ filePath }: { filePath: string }) {
  const segments = getWorkspaceSegments(filePath);

  return (
    <div className="flex items-center gap-0.5 px-3 h-6 bg-ide-bg border-b border-ide-border shrink-0">
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <ChevronRight size={11} className="text-ide-text-dimmer" />}
          <span
            className={`cursor-pointer hover:text-white transition-colors ${
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
  onTabChange,
  onTabClose,
  onTabPin,
  editorRef,
  jumpToLine,
  onCursorChange,
  onSplitEditor,
  onFocus,
  onTabDragStart,
  onTabDragEnd,
  contentCache,
  loadingFiles,
  loadErrors,
  onLoadFile,
  onContentChange,
  onEditorMount,
  showDragInteractionShield,
  dragInteractionShieldTestId,
}: EditorAreaProps) {
  const { activeTab, code, updateContent } = useEditorDocumentState({
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
    if (!jumpToLine || !editorRef.current) return;
    editorRef.current.revealLineInCenter(jumpToLine);
    editorRef.current.setPosition({ lineNumber: jumpToLine, column: 1 });
    editorRef.current.focus();
  }, [jumpToLine, editorRef]);

  if (tabs.length === 0) {
    return (
      <div className="flex flex-col h-full bg-ide-bg items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-ide-sidebar-bg flex items-center justify-center mx-auto mb-4">
            <span className="text-ide-accent text-[28px] font-bold">R</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-ide-bg overflow-hidden" onMouseDown={() => onFocus?.()}>
      {/* Tab bar */}
      <div className="flex items-stretch h-9 bg-ide-tab-bg overflow-x-auto shrink-0 border-b border-ide-sidebar-bg">
        {tabs.map((tab) => (
          <EditorTab
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onActivate={() => onTabChange(tab.id)}
            onClose={() => onTabClose(tab.id)}
            onPin={onTabPin ? () => onTabPin(tab.id) : undefined}
            onDragStart={onTabDragStart ? () => onTabDragStart(tab.id) : undefined}
            onDragEnd={onTabDragEnd}
          />
        ))}
        <div className="flex-1" />
        <button
          data-testid="editor-split-right"
          aria-label="Split Editor Right"
          onClick={() => onSplitEditor?.('horizontal')}
          className="px-2 text-ide-text-muted hover:bg-ide-tab-hover hover:text-ide-text transition-colors shrink-0"
          title="Split Editor Right"
        >
          <Split size={14} />
        </button>
        <button
          data-testid="editor-split-down"
          aria-label="Split Editor Down"
          onClick={() => onSplitEditor?.('vertical')}
          className="px-2 text-ide-text-muted hover:bg-ide-tab-hover hover:text-ide-text transition-colors shrink-0"
          title="Split Editor Down"
        >
          <Split size={14} className="rotate-90" />
        </button>
        <button className="px-2 text-ide-text-muted hover:text-ide-text transition-colors shrink-0">
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Breadcrumb */}
      {activeTab && <Breadcrumb filePath={activeTabId} />}

      <Suspense
        fallback={(
          <div className="flex flex-1 items-center justify-center bg-ide-editor-bg text-ide-text-muted text-[12px]">
            Loading editor...
          </div>
        )}
      >
        <MonacoEditorPane
          activeTabId={activeTabId}
          code={code}
          editorRef={editorRef}
          onCursorChange={onCursorChange}
          onContentChange={updateContent}
          onEditorMount={onEditorMount}
          showDragInteractionShield={showDragInteractionShield}
          dragInteractionShieldTestId={dragInteractionShieldTestId}
        />
      </Suspense>
    </div>
  );
}