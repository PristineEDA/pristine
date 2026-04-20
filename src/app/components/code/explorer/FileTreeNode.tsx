import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen,
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
import { formatShortcutLabel } from '../../../menu/shortcutLabels';
import { FileTypeBadge } from '../shared/FileTypeBadge';

interface ContextMenuItem {
  kind: 'item';
  label: string;
  action: () => void;
  disabled?: boolean;
  shortcut?: string;
  variant?: 'default' | 'destructive';
}

interface ContextMenuSeparatorItem {
  kind: 'separator';
  key: string;
}

type ExplorerContextMenuEntry = ContextMenuItem | ContextMenuSeparatorItem;

function ExplorerContextMenu({
  items,
  onClose,
  x,
  y,
}: {
  items: ExplorerContextMenuEntry[];
  onClose: () => void;
  x: number;
  y: number;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" data-testid="explorer-context-menu-backdrop" onClick={onClose} />
      <div
        role="menu"
        data-testid="explorer-context-menu"
        data-slot="context-menu-content"
        className="fixed z-50 min-w-36 overflow-hidden rounded-md border bg-popover p-0.5 text-popover-foreground shadow-md"
        style={{ left: x, top: y }}
      >
        {items.map((item) =>
          item.kind === 'separator' ? (
            <div
              key={item.key}
              role="separator"
              data-slot="context-menu-separator"
              className="-mx-1 my-0.5 h-px bg-border"
            />
          ) : (
            <div
              key={item.label}
              role="menuitem"
              tabIndex={-1}
              data-testid={toExplorerContextMenuItemTestId(item.label)}
              data-slot="context-menu-item"
              data-variant={item.variant ?? 'default'}
              data-disabled={item.disabled ? '' : undefined}
              aria-disabled={item.disabled ? 'true' : undefined}
              className={`relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1 text-[12px] outline-hidden select-none ${
                item.disabled
                  ? 'pointer-events-none opacity-50'
                  : 'text-foreground hover:bg-accent hover:text-accent-foreground'
              } ${item.variant === 'destructive' ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : ''}`}
              onClick={() => {
                if (item.disabled) {
                  return;
                }

                item.action();
                onClose();
              }}
            >
              {item.label}
              {item.shortcut ? (
                <span
                  aria-hidden="true"
                  data-slot="context-menu-shortcut"
                  className="ml-auto text-xs tracking-widest text-muted-foreground"
                >
                  {formatShortcutLabel(item.shortcut)}
                </span>
              ) : null}
            </div>
          )
        )}
      </div>
    </>
  );
}

const treeRowIndentStyleCache = new Map<number, React.CSSProperties>();

function createContextMenuSeparator(key: string): ContextMenuSeparatorItem {
  return {
    kind: 'separator',
    key,
  };
}

function createContextMenuItem({
  action,
  disabled,
  label,
  shortcut,
  variant,
}: {
  action: () => void;
  disabled?: boolean;
  label: string;
  shortcut?: string;
  variant?: 'default' | 'destructive';
}): ContextMenuItem {
  return {
    kind: 'item',
    label,
    action,
    disabled,
    shortcut,
    variant,
  };
}

function toExplorerContextMenuItemTestId(label: string): string {
  const normalizedLabel = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `explorer-context-menu-item-${normalizedLabel}`;
}

function getTreeRowIndentStyle(depth: number): React.CSSProperties {
  const cachedStyle = treeRowIndentStyleCache.get(depth);

  if (cachedStyle) {
    return cachedStyle;
  }

  const nextStyle = { paddingLeft: depth * 12 + 4 };
  treeRowIndentStyleCache.set(depth, nextStyle);
  return nextStyle;
}

// ─── File Icon ────────────────────────────────────────────────────────────────
export function FileIcon({ name }: { name: string; language?: string }) {
  return <FileTypeBadge name={name} className="text-[10px] font-bold font-mono" />;
}

function TreeEditInputRow({
  depth,
  errorMessage,
  isDraft,
  isExpanded,
  isFolder,
  isSelected,
  isSubmitting,
  testId,
  value,
  onBlur,
  onCancel,
  onChange,
  onSubmit,
}: {
  depth: number;
  errorMessage: string | null;
  isDraft: boolean;
  isExpanded?: boolean;
  isFolder: boolean;
  isSelected: boolean;
  isSubmitting: boolean;
  testId: string;
  value: string;
  onBlur: () => void;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div>
      <div
        data-testid={`file-tree-node-${testId}`}
        className={`flex items-center gap-1 h-6 transition-colors ${
          isSelected
            ? 'bg-primary/20 text-foreground hover:bg-primary/20'
            : 'text-foreground hover:bg-accent'
        } ${isDraft ? 'opacity-65' : ''}`}
        style={getTreeRowIndentStyle(depth)}
      >
        {isFolder ? (
          <>
            <span className="text-muted-foreground">
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
            {isExpanded
              ? <FolderOpen size={14} className="text-ide-syntax-folder shrink-0" />
              : <Folder size={14} className="text-ide-syntax-folder shrink-0" />}
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              <FileIcon name={value || 'new_file.sv'} />
            </span>
          </>
        )}
        <input
          ref={inputRef}
          data-testid={`file-tree-input-${testId}`}
          value={value}
          disabled={isSubmitting}
          aria-invalid={errorMessage ? 'true' : 'false'}
          className={`ml-1 h-5 flex-1 rounded border bg-background/80 px-2 text-[12px] outline-none transition-colors ${
            errorMessage
              ? 'border-destructive text-foreground focus:border-destructive'
              : 'border-border text-foreground focus:border-primary'
          } ${isSubmitting ? 'opacity-80' : ''}`}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void onSubmit();
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              onCancel();
            }
          }}
        />
      </div>
      {errorMessage && (
        <div className="px-3 py-1 text-[11px] text-destructive" style={{ paddingLeft: depth * 12 + 28 }}>
          {errorMessage}
        </div>
      )}
    </div>
  );
}

// ─── Recursive File Tree Node ─────────────────────────────────────────────────
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
  revealRequest,
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
  revealRequest?: WorkspaceRevealRequest | null;
}) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const isExpanded = expandedFolders.has(node.id);
  const isActive = node.id === activeFileId;
  const isSelected = selectedNode?.source === 'real' && selectedNode.path === node.path;
  const isActiveFileHighlighted = !selectedNode && isActive;
  const isPersistentlyHighlighted = isSelected || isActiveFileHighlighted;
  const isCutSource = workspaceClipboard?.mode === 'cut' && workspaceClipboard.sourcePath === node.path;
  const gitPathState = gitPathStates[node.path];
  const treeTestId = toTreeTestId(node.path);
  const labelColorClassName = gitPathState === 'modified'
    ? 'text-ide-warning'
    : gitPathState === 'ignored'
    ? 'text-ide-text-muted'
    : 'text-foreground';
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
  }, [node.path, revealRequest]);

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
              revealRequest={revealRequest}
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
            {isExpanded
              ? <FolderOpen size={14} className="text-ide-syntax-folder shrink-0" />
              : <Folder size={14} className="text-ide-syntax-folder shrink-0" />}
            <span
              data-testid={`file-tree-label-${treeTestId}`}
              className={`text-[13px] flex-1 truncate ml-1 ${labelColorClassName}`}
            >
              {node.name}
            </span>
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              <FileIcon name={node.name} />
            </span>
            <span
              data-testid={`file-tree-label-${treeTestId}`}
              className={`text-[13px] flex-1 truncate ml-1 ${labelColorClassName}`}
            >
              {node.name}
            </span>
          </>
        )}
      </div>

      {ctxMenu && (
        <ExplorerContextMenu
          items={contextItems}
          onClose={() => setCtxMenu(null)}
          x={ctxMenu.x}
          y={ctxMenu.y}
        />
      )}

      {node.type === 'folder' && isExpanded && node.isLoading && (
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
            revealRequest={revealRequest}
          />
        )
      ))}
    </div>
  );
});
