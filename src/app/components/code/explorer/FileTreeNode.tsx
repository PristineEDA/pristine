import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight, ChevronDown,
} from 'lucide-react';
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
import { WorkspaceFileIcon, WorkspaceFolderIcon } from '../shared/WorkspaceEntryIcon';
import {
  ExplorerContextMenu,
  createContextMenuItem,
  createContextMenuSeparator,
  type ExplorerContextMenuEntry,
  type ExplorerContextMenuRequest,
} from './FileTreeNodeContextMenu';
import {
  ExplorerGitIndicators,
  getExplorerGitIndicatorStates,
  getExplorerGitLabelClassName,
} from './FileTreeNodeGitIndicators';
import {
  getTreeRowIndentStyle,
  TreeEditInputRow,
} from './FileTreeNodeEditRow';

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
    const pasteTargetType = node.path === WORKSPACE_ROOT_PATH ? 'root' : node.type;
    const pasteItem = createContextMenuItem({
      label: 'Paste',
      action: () => onStartPaste?.(node.path, pasteTargetType),
      disabled: !workspaceClipboard,
      shortcut: 'Mod+V',
    });

    if (node.type === 'folder') {
      const items: ExplorerContextMenuEntry[] = [
        createContextMenuItem({
          label: 'New File',
          action: () => onStartCreateFile?.('file', node.path),
        }),
        createContextMenuItem({
          label: 'New Folder',
          action: () => onStartCreateFolder?.('folder', node.path),
        }),
        createContextMenuSeparator('create-separator'),
        createContextMenuItem({
          label: 'Copy',
          action: () => onStartCopy?.(node.path, 'folder'),
          shortcut: 'Mod+C',
        }),
        createContextMenuItem({
          label: 'Cut',
          action: () => onStartCut?.(node.path, 'folder'),
          shortcut: 'Mod+X',
        }),
        pasteItem,
        createContextMenuSeparator('clipboard-separator'),
      ];

      if (node.path !== WORKSPACE_ROOT_PATH) {
        items.push(createContextMenuItem({
          label: 'Rename',
          action: () => onStartRename?.(node.path, 'folder'),
          shortcut: 'F2',
        }));
        items.push(createContextMenuItem({
          label: 'Delete',
          action: () => onStartDelete?.(node.path, 'folder'),
          shortcut: 'Delete',
          variant: 'destructive',
        }));
        items.push(createContextMenuSeparator('manage-separator'));
      }

      return [
        ...items,
        createContextMenuItem({ label: 'Set as Simulation Top', action: () => {} }),
        createContextMenuItem({ label: 'Copy Path', action: () => {} }),
      ];
    }

    return [
      createContextMenuItem({ label: 'Open in Editor', action: openFileFromContextMenu }),
      createContextMenuSeparator('open-separator'),
      createContextMenuItem({
        label: 'Copy',
        action: () => onStartCopy?.(node.path, 'file'),
        shortcut: 'Mod+C',
      }),
      createContextMenuItem({
        label: 'Cut',
        action: () => onStartCut?.(node.path, 'file'),
        shortcut: 'Mod+X',
      }),
      pasteItem,
      createContextMenuSeparator('clipboard-separator'),
      createContextMenuItem({
        label: 'Rename',
        action: () => onStartRename?.(node.path, 'file'),
        shortcut: 'F2',
      }),
      createContextMenuItem({
        label: 'Delete',
        action: () => onStartDelete?.(node.path, 'file'),
        shortcut: 'Delete',
        variant: 'destructive',
      }),
      createContextMenuSeparator('manage-separator'),
      createContextMenuItem({ label: 'Set as Simulation Top', action: () => {} }),
      createContextMenuItem({ label: 'Copy Path', action: () => {} }),
      createContextMenuItem({ label: 'Copy Relative Path', action: () => {} }),
    ];
  }, [
    node.path,
    node.type,
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

  if (isEditingCurrentNode && treeEditSession) {
    return (
      <div>
        <TreeEditInputRow
          depth={depth}
          errorMessage={treeEditSession.submitError ?? treeEditValidation?.errorMessage ?? null}
          isDraft={false}
          isExpanded={node.type === 'folder' ? isExpanded : undefined}
          isFolder={node.type === 'folder'}
          isSelected={true}
          isSubmitting={treeEditSession.isSubmitting}
          testId={treeTestId}
          value={treeEditSession.value}
          onBlur={() => onCancelEdit?.()}
          onCancel={() => onCancelEdit?.()}
          onChange={(value) => onEditValueChange?.(value)}
          onSubmit={() => onSubmitEdit?.()}
        />
        {node.type === 'folder' && isExpanded && node.isLoading && (
          <div className="text-[12px] text-muted-foreground pl-8 py-1">
            Loading...
          </div>
        )}
        {node.type === 'folder' && isExpanded && childNodes.map((child) => (
          child.isDraft ? (
            <TreeEditInputRow
              key={child.id}
              depth={depth + 1}
              errorMessage={treeEditSession.submitError ?? treeEditValidation?.errorMessage ?? null}
              isDraft={true}
              isFolder={child.type === 'folder'}
              isSelected={selectedNode?.source === 'draft' && selectedNode.id === child.id}
              isSubmitting={treeEditSession.isSubmitting}
              testId={toTreeTestId(child.path)}
              value={treeEditSession.value}
              onBlur={() => onCancelEdit?.()}
              onCancel={() => onCancelEdit?.()}
              onChange={(value) => onEditValueChange?.(value)}
              onSubmit={() => onSubmitEdit?.()}
            />
          ) : (
            <FileTreeNode
              key={child.id}
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
          )
        ))}
      </div>
    );
  }

  return (
    <div>
      <div
        ref={rowRef}
        data-testid={`file-tree-node-${treeTestId}`}
        className={`flex items-center gap-1 h-6 cursor-pointer group transition-colors ${
          isPersistentlyHighlighted
            ? 'bg-primary/20 text-foreground hover:bg-primary/20'
            : 'text-foreground hover:bg-accent'
        } ${isCutSource ? 'opacity-50' : ''}`}
        style={rowIndentStyle}
        onClick={() => {
          selectCurrentNode();
          if (node.type === 'folder') {
            onToggleFolder(node.id);
            return;
          }

          onFilePreview(node.path, node.name);
        }}
        onDoubleClick={() => {
          if (node.type === 'file') {
            selectCurrentNode();
            onFileOpen(node.path, node.name);
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          selectCurrentNode();
          setCtxMenu({ x: event.clientX, y: event.clientY });
        }}
      >
        {node.type === 'folder' ? (
          <>
            <span className="text-muted-foreground">
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
            <WorkspaceFolderIcon
              name={node.name}
              isOpen={isExpanded}
              isRoot={node.path === WORKSPACE_ROOT_PATH}
              className="h-4 w-4"
              testId={`file-tree-icon-${treeTestId}`}
            />
            <span className="ml-1 flex min-w-0 flex-1 items-center">
              <span
                data-testid={`file-tree-label-${treeTestId}`}
                className={`min-w-0 truncate text-[13px] ${labelColorClassName}`}
              >
                {node.name}
              </span>
            </span>
            <ExplorerGitIndicators indicatorStates={gitIndicatorStates} testId={treeTestId} />
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              <WorkspaceFileIcon name={node.name} className="h-4 w-4" testId={`file-tree-icon-${treeTestId}`} />
            </span>
            <span className="ml-1 flex min-w-0 flex-1 items-center">
              <span
                data-testid={`file-tree-label-${treeTestId}`}
                className={`min-w-0 truncate text-[13px] ${labelColorClassName}`}
              >
                {node.name}
              </span>
            </span>
            <ExplorerGitIndicators indicatorStates={gitIndicatorStates} testId={treeTestId} />
          </>
        )}
      </div>

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

      {node.type === 'folder' && isExpanded && childNodes.map((child) => (
        child.isDraft && treeEditSession ? (
          <TreeEditInputRow
            key={child.id}
            depth={depth + 1}
            errorMessage={treeEditSession.submitError ?? treeEditValidation?.errorMessage ?? null}
            isDraft={true}
            isFolder={child.type === 'folder'}
            isSelected={selectedNode?.source === 'draft' && selectedNode.id === child.id}
            isSubmitting={treeEditSession.isSubmitting}
            testId={toTreeTestId(child.path)}
            value={treeEditSession.value}
            onBlur={() => onCancelEdit?.()}
            onCancel={() => onCancelEdit?.()}
            onChange={(value) => onEditValueChange?.(value)}
            onSubmit={() => onSubmitEdit?.()}
          />
        ) : (
          <FileTreeNode
            key={child.id}
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
        )
      ))}
    </div>
  );
});
