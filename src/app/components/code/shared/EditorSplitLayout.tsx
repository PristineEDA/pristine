import { useMemo, useRef, useState } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../../ui/resizable';
import { EditorArea } from './EditorArea';
import { useWorkspace } from '../../../context/WorkspaceContext';
import type { EditorDropPosition, EditorLayoutNode, SplitDirection } from '../../../editor/editorLayout';

interface DragState {
  sourceGroupId: string;
  tabId: string;
}

interface DropTargetState {
  groupId: string;
  position: EditorDropPosition;
}

const DROP_POSITION_LABELS: Record<EditorDropPosition, string> = {
  center: 'Move to group',
  left: 'Split left',
  right: 'Split right',
  top: 'Split up',
  bottom: 'Split down',
};

const DROP_ZONE_CLASS_NAMES: Record<EditorDropPosition, string> = {
  center: 'left-[20%] right-[20%] top-[20%] bottom-[20%]',
  left: 'left-0 top-0 bottom-0 w-1/2',
  right: 'right-0 top-0 bottom-0 w-1/2',
  top: 'left-0 right-0 top-0 h-1/2',
  bottom: 'left-0 right-0 bottom-0 h-1/2',
};

const DROP_PREVIEW_CLASS_NAMES: Record<EditorDropPosition, string> = {
  center: 'left-[20%] right-[20%] top-[20%] bottom-[20%] rounded-sm border border-muted-foreground/70 bg-primary/20',
  left: 'left-1/2 top-3 bottom-3 w-px -translate-x-1/2 bg-muted-foreground/75',
  right: 'right-1/2 top-3 bottom-3 w-px translate-x-1/2 bg-muted-foreground/75',
  top: 'left-3 right-3 top-1/2 h-px -translate-y-1/2 bg-muted-foreground/75',
  bottom: 'left-3 right-3 bottom-1/2 h-px translate-y-1/2 bg-muted-foreground/75',
};

function ResizeHandle({ direction }: { direction: SplitDirection }) {
  return (
    <ResizableHandle
      className={`group relative flex items-center justify-center ${
        direction === 'horizontal' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'
      } bg-border hover:bg-primary transition-colors z-10`}
    >
      <div
        className={`${
          direction === 'horizontal' ? 'w-0.5 h-8' : 'h-0.5 w-8'
        } bg-border group-hover:bg-primary rounded transition-colors`}
      />
    </ResizableHandle>
  );
}

function getDropPosition(rect: DOMRect, clientX: number, clientY: number): EditorDropPosition {
  const relativeX = (clientX - rect.left) / rect.width;
  const relativeY = (clientY - rect.top) / rect.height;
  const edgeThreshold = 0.22;

  if (relativeY <= edgeThreshold) {
    return 'top';
  }

  if (relativeY >= 1 - edgeThreshold) {
    return 'bottom';
  }

  if (relativeX <= edgeThreshold) {
    return 'left';
  }

  if (relativeX >= 1 - edgeThreshold) {
    return 'right';
  }

  return 'center';
}

function DropIndicator({ position }: { position: EditorDropPosition }) {
  const orderedPositions: EditorDropPosition[] = ['left', 'top', 'center', 'right', 'bottom'];

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className="absolute inset-2 rounded-sm border border-border/55 bg-primary/12 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]" />
      {orderedPositions.map((candidatePosition) => {
        const isActive = candidatePosition === position;

        return (
          <div
            key={candidatePosition}
            className={`absolute rounded-sm border transition-all duration-150 ease-out ${DROP_ZONE_CLASS_NAMES[candidatePosition]} ${
              isActive
                ? 'border-muted-foreground/65 bg-primary/30 opacity-100 scale-100'
                : 'border-border/18 bg-border/8 opacity-0 scale-[0.985]'
            }`}
          />
        );
      })}
      <div
        data-testid={`editor-drop-indicator-${position}`}
        className={`absolute transition-all duration-150 ease-out ${DROP_PREVIEW_CLASS_NAMES[position]} ${
          position === 'center' ? 'shadow-[0_0_0_1px_rgba(0,0,0,0.18)]' : 'shadow-[0_0_6px_rgba(204,204,204,0.16)]'
        }`}
      />
      <div className="absolute bottom-3 right-3 rounded-sm border border-border/70 bg-popover/95 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-all duration-150 ease-out">
        {DROP_POSITION_LABELS[position]}
      </div>
    </div>
  );
}

function EditorGroupLeaf({
  groupId,
  focused,
  jumpToLine,
  dropPosition,
  onDropPosition,
  onClearDrop,
  onFocus,
  onMoveTab,
  onDragStart,
  onDragEnd,
  dragState,
}: {
  groupId: string;
  focused: boolean;
  jumpToLine?: number;
  dropPosition: EditorDropPosition | null;
  onDropPosition: (groupId: string, position: EditorDropPosition) => void;
  onClearDrop: (groupId: string) => void;
  onFocus: (groupId: string) => void;
  onMoveTab: (targetGroupId: string, position: EditorDropPosition) => void;
  onDragStart: (tabId: string) => void;
  onDragEnd: () => void;
  dragState: DragState | null;
}) {
  const {
    editorGroups,
    setActiveTabIdInGroup,
    pinTabInGroup,
    closeFileInGroup,
    splitGroup,
    setCursorPos,
    fileContents,
    loadingFiles,
    loadErrors,
    loadFileContent,
    updateFileContent,
    registerEditorRef,
  } = useWorkspace();
  const group = editorGroups.find((currentGroup) => currentGroup.id === groupId);
  const editorRef = useRef<any>(null);

  if (!group) {
    return null;
  }

  const showFocusRing = focused && group.tabs.length > 0;

  return (
    <div
      data-testid={`editor-group-${group.id}`}
      data-focused={focused ? 'true' : 'false'}
      className={`relative h-full min-w-0 ${showFocusRing ? 'ring-1 ring-inset ring-primary/50' : ''} ${dropPosition ? 'ring-1 ring-inset ring-border/80' : ''}`}
      onMouseDown={() => onFocus(group.id)}
      onDragOver={(event) => {
        if (!dragState) {
          return;
        }

        event.preventDefault();
        onDropPosition(group.id, getDropPosition(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY));
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }

        onClearDrop(group.id);
      }}
      onDrop={(event) => {
        if (!dragState) {
          return;
        }

        event.preventDefault();
        onMoveTab(group.id, getDropPosition(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY));
      }}
    >
      {dropPosition && <DropIndicator position={dropPosition} />}
      <EditorArea
        tabs={group.tabs}
        activeTabId={group.activeTabId}
        onTabChange={(tabId) => setActiveTabIdInGroup(group.id, tabId)}
        onTabClose={(tabId) => closeFileInGroup(group.id, tabId)}
        onTabPin={(tabId) => pinTabInGroup(group.id, tabId)}
        editorRef={editorRef}
        jumpToLine={focused ? jumpToLine : undefined}
        onCursorChange={(line, col) => setCursorPos(line, col, group.id)}
        onSplitEditor={(direction) => splitGroup(group.id, direction)}
        onFocus={() => onFocus(group.id)}
        onTabDragStart={onDragStart}
        onTabDragEnd={onDragEnd}
        contentCache={fileContents}
        loadingFiles={loadingFiles}
        loadErrors={loadErrors}
        onLoadFile={loadFileContent}
        onContentChange={updateFileContent}
        onEditorMount={(editor) => registerEditorRef(group.id, editor)}
        showDragInteractionShield={Boolean(dragState)}
        dragInteractionShieldTestId={`editor-drag-shield-${group.id}`}
      />
    </div>
  );
}

export function EditorSplitLayout({ jumpToLine }: { jumpToLine?: number }) {
  const {
    editorLayout,
    focusedGroupId,
    focusGroup,
    moveTab,
    editorGroups,
  } = useWorkspace();
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTargetState | null>(null);

  const groupsById = useMemo(
    () => Object.fromEntries(editorGroups.map((group) => [group.id, group])),
    [editorGroups],
  );

  const clearDragState = () => {
    setDragState(null);
    setDropTarget(null);
  };

  const renderNode = (node: EditorLayoutNode | null): React.ReactNode => {
    if (!node) {
      return (
        <EditorArea
          tabs={[]}
          activeTabId=""
          onTabChange={() => undefined}
          onTabClose={() => undefined}
          editorRef={{ current: null }}
        />
      );
    }

    if (node.type === 'group') {
      const group = groupsById[node.groupId];
      if (!group) {
        return null;
      }

      return (
        <EditorGroupLeaf
          key={group.id}
          groupId={group.id}
          focused={focusedGroupId === group.id}
          jumpToLine={jumpToLine}
          dropPosition={dropTarget?.groupId === group.id ? dropTarget.position : null}
          onDropPosition={(groupId, position) => setDropTarget({ groupId, position })}
          onClearDrop={(groupId) => setDropTarget((current) => (current?.groupId === groupId ? null : current))}
          onFocus={focusGroup}
          onMoveTab={(targetGroupId, position) => {
            if (!dragState) {
              return;
            }

            moveTab(dragState.sourceGroupId, dragState.tabId, targetGroupId, position);
            clearDragState();
          }}
          onDragStart={(tabId) => setDragState({ sourceGroupId: group.id, tabId })}
          onDragEnd={clearDragState}
          dragState={dragState}
        />
      );
    }

    const direction = node.direction;
    return (
      <ResizablePanelGroup orientation={direction} className="h-full min-w-0">
        <ResizablePanel defaultSize={50} minSize={15}>
          {renderNode(node.children[0])}
        </ResizablePanel>
        <ResizeHandle direction={direction} />
        <ResizablePanel defaultSize={50} minSize={15}>
          {renderNode(node.children[1])}
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  };

  return <div className="h-full min-w-0">{renderNode(editorLayout)}</div>;
}
