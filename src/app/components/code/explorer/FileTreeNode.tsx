import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  WORKSPACE_ROOT_PATH,
  WorkspaceTreeNode,
  createExplorerDraftNode,
  mergeWorkspaceChildrenWithDraft,
  toTreeTestId,
  type ExplorerSelectedNode,
  type ExplorerTreeEditSession,
  type WorkspaceClipboardState,
  type WorkspaceEntryNameValidationResult,
} from '../../../workspace/workspaceFiles';
import type { WorkspaceRevealRequest } from '../../../workspace/useWorkspaceTree';
import type { WorkspaceGitPathState } from '../../../../../types/workspace-git';
import {
  ExplorerContextMenu,
  createExplorerTreeContextMenuItems,
  type ExplorerContextMenuEntry,
  type ExplorerContextMenuRequest,
} from './FileTreeNodeContextMenu';
import {
  getExplorerGitIndicatorStates,
  getExplorerGitLabelClassName,
} from './FileTreeNodeGitIndicators';
import {
  getTreeRowIndentStyle,
} from './FileTreeNodeEditRow';
import { FileTreeNodeChildren } from './FileTreeNodeChildren';
import { FileTreeNodeEditBranch } from './FileTreeNodeEditBranch';
import { FileTreeNodeRow } from './FileTreeNodeRow';

export type { ExplorerContextMenuRequest } from './FileTreeNodeContextMenu';
export { FileIcon } from './FileTreeNodeEditRow';

export const FileTreeNode = memo(function FileTreeNode({
  node,
  depth,
  activeFileId,
  onFileOpen,
  onFilePreview,
  onCancelEdit,
  onEditValueChange,
  onSelectNode,
  onStartCreateFile,
  onStartCreateFolder,
  onStartCopy,
  onStartCut,
  onStartDelete,
  onStartPaste,
  onStartRename,
  onSubmitEdit,
  expandedFolders,
  onToggleFolder,
  selectedNode,
  treeEditSession,
  treeEditValidation,
  workspaceClipboard,
  gitPathStates,
  onTreeInteract,
  onRequestTreeFocus,
  contextMenuRequest,
  revealRequest,
  onRevealHandled,
}: {
  node: WorkspaceTreeNode;
  depth: number;
  activeFileId: string;
  onFileOpen: (id: string, name: string) => void;
  onFilePreview: (id: string, name: string) => void;
  onCancelEdit?: () => void;
  onEditValueChange?: (value: string) => void;
  onSelectNode?: (node: ExplorerSelectedNode) => void;
  onStartCreateFile?: (entryType: 'file', parentPath?: string) => void;
  onStartCreateFolder?: (entryType: 'folder', parentPath?: string) => void;
  onStartCopy?: (path: string, entryType: 'file' | 'folder') => void;
  onStartCut?: (path: string, entryType: 'file' | 'folder') => void;
  onStartDelete?: (path: string, entryType: 'file' | 'folder') => void;
  onStartPaste?: (path: string, entryType: ExplorerSelectedNode['type']) => void;
  onStartRename?: (path: string, entryType: 'file' | 'folder') => void;
  onSubmitEdit?: () => void;
  expandedFolders: Set<string>;
  onToggleFolder: (id: string) => void;
  selectedNode?: ExplorerSelectedNode | null;
  treeEditSession?: ExplorerTreeEditSession | null;
  treeEditValidation?: WorkspaceEntryNameValidationResult | null;
  workspaceClipboard?: WorkspaceClipboardState | null;
  gitPathStates: Record<string, WorkspaceGitPathState>;
  onTreeInteract?: () => void;
  onRequestTreeFocus?: () => void;
  contextMenuRequest?: ExplorerContextMenuRequest | null;
  revealRequest?: WorkspaceRevealRequest | null;
  onRevealHandled?: (token: number) => void;
}) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const lastHandledContextMenuRequestTokenRef = useRef<number | null>(null);
  const isExpanded = expandedFolders.has(node.id);
  const isActive = node.id === activeFileId;
  const isSelected = selectedNode?.source === 'real' && selectedNode.path === node.path;
  const isActiveFileHighlighted = !selectedNode && isActive;
  const isPersistentlyHighlighted = isSelected || isActiveFileHighlighted;
  const isCutSource = workspaceClipboard?.mode === 'cut' && workspaceClipboard.sourcePath === node.path;
  const gitPathState = gitPathStates[node.path];
  const treeTestId = toTreeTestId(node.path);
  const gitIndicatorStates = useMemo(
    () => getExplorerGitIndicatorStates(node, gitPathStates),
    [gitPathStates, node],
  );
  const labelColorClassName = getExplorerGitLabelClassName(gitPathState, gitIndicatorStates);
  const rowIndentStyle = getTreeRowIndentStyle(depth);
  const isEditingCurrentNode = treeEditSession?.mode === 'rename' && treeEditSession.targetPath === node.path;
  const draftNode = useMemo(() => {
    if (!treeEditSession || treeEditSession.mode === 'rename' || treeEditSession.parentPath !== node.path) {
      return null;
    }

    return createExplorerDraftNode(
      treeEditSession.parentPath,
      treeEditSession.entryType,
      treeEditSession.targetNodeId,
      treeEditSession.value,
    );
  }, [node.path, treeEditSession]);
  const childNodes = useMemo(
    () => mergeWorkspaceChildrenWithDraft(node.children, draftNode),
    [draftNode, node.children],
  );

  const openFileFromContextMenu = useCallback(() => {
    onFileOpen(node.path, node.name);
  }, [node.name, node.path, onFileOpen]);

  const selectCurrentNode = useCallback(() => {
    onSelectNode?.({
      id: node.id,
      path: node.path,
      type: node.path === WORKSPACE_ROOT_PATH ? 'root' : node.type,
      source: 'real',
    });
    onTreeInteract?.();
  }, [node.id, node.path, node.type, onSelectNode, onTreeInteract]);

  const handleRowClick = useCallback(() => {
    selectCurrentNode();
    if (node.type === 'folder') {
      onToggleFolder(node.id);
      return;
    }

    onFilePreview(node.path, node.name);
  }, [node.id, node.name, node.path, node.type, onFilePreview, onToggleFolder, selectCurrentNode]);

  const handleRowDoubleClick = useCallback(() => {
    if (node.type === 'file') {
      selectCurrentNode();
      onFileOpen(node.path, node.name);
    }
  }, [node.name, node.path, node.type, onFileOpen, selectCurrentNode]);

  const handleRowContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    selectCurrentNode();
    setCtxMenu({ x: event.clientX, y: event.clientY });
  }, [selectCurrentNode]);

  useEffect(() => {
    if (revealRequest?.path !== node.path) {
      return;
    }

    rowRef.current?.scrollIntoView({ block: 'nearest' });
    onRevealHandled?.(revealRequest.token);
  }, [node.path, onRevealHandled, revealRequest]);

  useEffect(() => {
    if (!contextMenuRequest || contextMenuRequest.path !== node.path) {
      return;
    }

    if (lastHandledContextMenuRequestTokenRef.current === contextMenuRequest.token) {
      return;
    }

    lastHandledContextMenuRequestTokenRef.current = contextMenuRequest.token;

    const rowBounds = rowRef.current?.getBoundingClientRect();

    if (!rowBounds) {
      return;
    }

    setCtxMenu({
      x: Math.round(rowBounds.left + 24),
      y: Math.round(rowBounds.top + rowBounds.height / 2),
    });
  }, [contextMenuRequest, node.path]);

  const contextItems = useMemo<ExplorerContextMenuEntry[]>(() => {
    return createExplorerTreeContextMenuItems({
      node,
      onOpenFile: openFileFromContextMenu,
      onStartCopy,
      onStartCreateFile,
      onStartCreateFolder,
      onStartCut,
      onStartDelete,
      onStartPaste,
      onStartRename,
      workspaceClipboard,
    });
  }, [
    node,
    onStartCopy,
    onStartCreateFile,
    onStartCreateFolder,
    onStartCut,
    onStartDelete,
    onStartPaste,
    onStartRename,
    openFileFromContextMenu,
    workspaceClipboard,
  ]);

  const renderChildNode = useCallback((child: WorkspaceTreeNode) => (
    <FileTreeNode
      node={child}
      depth={depth + 1}
      activeFileId={activeFileId}
      onFileOpen={onFileOpen}
      onFilePreview={onFilePreview}
      onCancelEdit={onCancelEdit}
      onEditValueChange={onEditValueChange}
      onSelectNode={onSelectNode}
      onStartCreateFile={onStartCreateFile}
      onStartCreateFolder={onStartCreateFolder}
      onStartCopy={onStartCopy}
      onStartCut={onStartCut}
      onStartDelete={onStartDelete}
      onStartPaste={onStartPaste}
      onStartRename={onStartRename}
      onSubmitEdit={onSubmitEdit}
      expandedFolders={expandedFolders}
      onToggleFolder={onToggleFolder}
      selectedNode={selectedNode}
      treeEditSession={treeEditSession}
      treeEditValidation={treeEditValidation}
      workspaceClipboard={workspaceClipboard}
      gitPathStates={gitPathStates}
      onTreeInteract={onTreeInteract}
      onRequestTreeFocus={onRequestTreeFocus}
      contextMenuRequest={contextMenuRequest}
      revealRequest={revealRequest}
      onRevealHandled={onRevealHandled}
    />
  ), [
    activeFileId,
    contextMenuRequest,
    depth,
    expandedFolders,
    gitPathStates,
    onCancelEdit,
    onEditValueChange,
    onFileOpen,
    onFilePreview,
    onRevealHandled,
    onRequestTreeFocus,
    onSelectNode,
    onStartCopy,
    onStartCreateFile,
    onStartCreateFolder,
    onStartCut,
    onStartDelete,
    onStartPaste,
    onStartRename,
    onSubmitEdit,
    onToggleFolder,
    onTreeInteract,
    revealRequest,
    selectedNode,
    treeEditSession,
    treeEditValidation,
    workspaceClipboard,
  ]);

  if (isEditingCurrentNode && treeEditSession) {
    return (
      <FileTreeNodeEditBranch
        childNodes={childNodes}
        depth={depth}
        isExpanded={isExpanded}
        node={node}
        selectedNode={selectedNode}
        testId={treeTestId}
        treeEditSession={treeEditSession}
        treeEditValidation={treeEditValidation}
        onCancelEdit={onCancelEdit}
        onEditValueChange={onEditValueChange}
        onSubmitEdit={onSubmitEdit}
        renderChildNode={renderChildNode}
      />
    );
  }

  return (
    <div>
      <FileTreeNodeRow
        gitIndicatorStates={gitIndicatorStates}
        isCutSource={isCutSource}
        isExpanded={isExpanded}
        isPersistentlyHighlighted={isPersistentlyHighlighted}
        labelColorClassName={labelColorClassName}
        node={node}
        rowIndentStyle={rowIndentStyle}
        rowRef={rowRef}
        testId={treeTestId}
        onClick={handleRowClick}
        onContextMenu={handleRowContextMenu}
        onDoubleClick={handleRowDoubleClick}
      />

      {ctxMenu && (
        <ExplorerContextMenu
          items={contextItems}
          onClose={() => setCtxMenu(null)}
          onRequestTreeFocus={onRequestTreeFocus}
          x={ctxMenu.x}
          y={ctxMenu.y}
        />
      )}

      {node.type === 'folder' && isExpanded && node.isLoading && !node.hasLoadedChildren && (
        <div className="text-[12px] text-muted-foreground pl-8 py-1">
          Loading...
        </div>
      )}

      {node.type === 'folder' && isExpanded && (
        <FileTreeNodeChildren
          childNodes={childNodes}
          depth={depth + 1}
          selectedNode={selectedNode}
          treeEditSession={treeEditSession}
          treeEditValidation={treeEditValidation}
          onCancelEdit={onCancelEdit}
          onEditValueChange={onEditValueChange}
          onSubmitEdit={onSubmitEdit}
          renderChildNode={renderChildNode}
        />
      )}
    </div>
  );
});
