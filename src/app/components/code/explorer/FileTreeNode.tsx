import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { formatShortcutLabel } from '../../../menu/shortcutLabels';
import { WorkspaceFileIcon, WorkspaceFolderIcon } from '../shared/WorkspaceEntryIcon';

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

const EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING = 8;

export interface ExplorerContextMenuRequest {
  path: string;
  token: number;
}

function getFirstEnabledContextMenuItemIndex(items: ExplorerContextMenuEntry[]): number | null {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    if (item?.kind === 'item' && !item.disabled) {
      return index;
    }
  }

  return null;
}

function getLastEnabledContextMenuItemIndex(items: ExplorerContextMenuEntry[]): number | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];

    if (item?.kind === 'item' && !item.disabled) {
      return index;
    }
  }

  return null;
}

function getNextEnabledContextMenuItemIndex(
  items: ExplorerContextMenuEntry[],
  startIndex: number | null,
  direction: 1 | -1,
): number | null {
  const enabledIndices = items.flatMap((item, index) => (
    item.kind === 'item' && !item.disabled ? [index] : []
  ));

  if (enabledIndices.length === 0) {
    return null;
  }

  if (startIndex === null) {
    return direction === 1 ? enabledIndices[0] ?? null : enabledIndices[enabledIndices.length - 1] ?? null;
  }

  const currentPosition = enabledIndices.indexOf(startIndex);

  if (currentPosition === -1) {
    return direction === 1 ? enabledIndices[0] ?? null : enabledIndices[enabledIndices.length - 1] ?? null;
  }

  const nextPosition = (currentPosition + direction + enabledIndices.length) % enabledIndices.length;
  return enabledIndices[nextPosition] ?? null;
}

function getExplorerContextMenuTop(menuHeight: number, y: number, viewportHeight: number): { top: number; side: 'top' | 'bottom' } {
  const maxTop = Math.max(
    EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING,
    viewportHeight - menuHeight - EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING,
  );

  if (y + menuHeight + EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING <= viewportHeight) {
    return {
      top: Math.min(y, maxTop),
      side: 'bottom',
    };
  }

  return {
    top: Math.max(
      EXPLORER_CONTEXT_MENU_VIEWPORT_PADDING,
      Math.min(y - menuHeight, maxTop),
    ),
    side: 'top',
  };
}

function ExplorerContextMenu({
  items,
  onClose,
  onRequestTreeFocus,
  x,
  y,
}: {
  items: ExplorerContextMenuEntry[];
  onClose: () => void;
  onRequestTreeFocus?: () => void;
  x: number;
  y: number;
}) {
  const itemRefs = useRef(new Map<number, HTMLDivElement | null>());
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(() => getFirstEnabledContextMenuItemIndex(items));
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number; side: 'top' | 'bottom' }>({
    left: x,
    top: y,
    side: 'bottom',
  });

  const focusMenuItem = useCallback((index: number | null) => {
    setFocusedItemIndex(index);

    if (index === null) {
      return;
    }

    itemRefs.current.get(index)?.focus();
  }, []);

  const restoreTreeFocus = useCallback((deferUntilAfterAction: boolean) => {
    if (!onRequestTreeFocus) {
      return;
    }

    if (deferUntilAfterAction) {
      requestAnimationFrame(() => {
        const activeElement = document.activeElement;

        if (!activeElement || activeElement === document.body) {
          onRequestTreeFocus();
        }
      });
      return;
    }

    onRequestTreeFocus();
  }, [onRequestTreeFocus]);

  const closeMenu = useCallback((deferFocusRestore = false) => {
    onClose();
    restoreTreeFocus(deferFocusRestore);
  }, [onClose, restoreTreeFocus]);

  const activateMenuItem = useCallback((index: number) => {
    const item = items[index];

    if (!item || item.kind !== 'item' || item.disabled) {
      return;
    }

    item.action();
    closeMenu(true);
  }, [closeMenu, items]);

  const handleMenuKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(getNextEnabledContextMenuItemIndex(items, focusedItemIndex, 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(getNextEnabledContextMenuItemIndex(items, focusedItemIndex, -1));
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(getFirstEnabledContextMenuItemIndex(items));
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(getLastEnabledContextMenuItemIndex(items));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      if (focusedItemIndex === null) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      activateMenuItem(focusedItemIndex);
      return;
    }

    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
    }
  }, [activateMenuItem, closeMenu, focusMenuItem, focusedItemIndex, items]);

  useLayoutEffect(() => {
    const firstEnabledItemIndex = getFirstEnabledContextMenuItemIndex(items);
    setFocusedItemIndex(firstEnabledItemIndex);

    if (firstEnabledItemIndex === null) {
      return;
    }

    itemRefs.current.get(firstEnabledItemIndex)?.focus();
  }, [items]);

  useLayoutEffect(() => {
    const menuElement = menuRef.current;

    if (!menuElement) {
      return;
    }

    const { height } = menuElement.getBoundingClientRect();
    const { top, side } = getExplorerContextMenuTop(height, y, window.innerHeight);

    setMenuPosition((current) => {
      if (current.left === x && current.top === top && current.side === side) {
        return current;
      }

      return {
        left: x,
        top,
        side,
      };
    });
  }, [items, x, y]);

  return (
    <>
      <div className="fixed inset-0 z-40" data-testid="explorer-context-menu-backdrop" onClick={() => closeMenu()} />
      <div
        ref={menuRef}
        role="menu"
        aria-orientation="vertical"
        data-testid="explorer-context-menu"
        data-slot="context-menu-content"
        data-side={menuPosition.side}
        className="fixed z-50 min-w-36 overflow-hidden rounded-md border bg-popover p-0.5 text-popover-foreground shadow-md"
        style={{ left: menuPosition.left, top: menuPosition.top }}
        onKeyDown={handleMenuKeyDown}
      >
        {items.map((item, index) =>
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
              ref={(node) => {
                itemRefs.current.set(index, node);
              }}
              role="menuitem"
              tabIndex={focusedItemIndex === index ? 0 : -1}
              data-testid={toExplorerContextMenuItemTestId(item.label)}
              data-slot="context-menu-item"
              data-variant={item.variant ?? 'default'}
              data-disabled={item.disabled ? '' : undefined}
              aria-disabled={item.disabled ? 'true' : undefined}
              className={`relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1 text-[12px] outline-hidden select-none focus:bg-accent focus:text-accent-foreground ${
                item.disabled
                  ? 'pointer-events-none opacity-50'
                  : 'text-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
              onFocus={() => {
                if (!item.disabled) {
                  setFocusedItemIndex(index);
                }
              }}
              onMouseEnter={() => {
                if (!item.disabled) {
                  focusMenuItem(index);
                }
              }}
              onClick={() => {
                if (item.disabled) {
                  return;
                }

                activateMenuItem(index);
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
  return <WorkspaceFileIcon name={name} className="h-4 w-4" />;
}

type ExplorerGitIndicatorState = Exclude<WorkspaceGitPathState, 'ignored'>;

const EXPLORER_GIT_INDICATOR_ORDER: ExplorerGitIndicatorState[] = ['created', 'modified', 'deleted'];

function isExplorerGitIndicatorState(
  state: WorkspaceGitPathState | undefined,
): state is ExplorerGitIndicatorState {
  return state === 'created' || state === 'modified' || state === 'deleted';
}

function getExplorerGitToneClassName(state: ExplorerGitIndicatorState): string {
  if (state === 'created') {
    return 'text-ide-success';
  }

  if (state === 'deleted') {
    return 'text-ide-error';
  }

  return 'text-ide-warning';
}

function getExplorerGitIndicatorStates(
  node: WorkspaceTreeNode,
  gitPathStates: Record<string, WorkspaceGitPathState>,
): ExplorerGitIndicatorState[] {
  if (node.type === 'file') {
    const directState = gitPathStates[node.path];
    return isExplorerGitIndicatorState(directState) ? [directState] : [];
  }

  const matchingStates = new Set<ExplorerGitIndicatorState>();
  const nodePathPrefix = node.path === WORKSPACE_ROOT_PATH ? '' : `${node.path}/`;

  Object.entries(gitPathStates).forEach(([path, state]) => {
    if (!isExplorerGitIndicatorState(state)) {
      return;
    }

    if (node.path === WORKSPACE_ROOT_PATH || path === node.path || path.startsWith(nodePathPrefix)) {
      matchingStates.add(state);
    }
  });

  return EXPLORER_GIT_INDICATOR_ORDER.filter((state) => matchingStates.has(state));
}

function getExplorerGitLabelClassName(
  directGitPathState: WorkspaceGitPathState | undefined,
  indicatorStates: ExplorerGitIndicatorState[],
): string {
  if (directGitPathState === 'ignored') {
    return 'text-ide-text-muted-stronger dark:text-ide-text-muted';
  }

  const dominantState = indicatorStates[0];
  if (dominantState) {
    return getExplorerGitToneClassName(dominantState);
  }

  return 'text-foreground';
}

function ExplorerGitIndicators({
  indicatorStates,
  testId,
}: {
  indicatorStates: ExplorerGitIndicatorState[];
  testId: string;
}) {
  if (indicatorStates.length === 0) {
    return null;
  }

  return (
    <span
      data-testid={`file-tree-git-indicators-${testId}`}
      className="ml-auto flex shrink-0 items-center gap-1.5 pr-2"
    >
      {indicatorStates.map((state) => (
        <span
          key={state}
          data-testid={`file-tree-git-indicator-${state}-${testId}`}
          className={`relative flex h-2.5 w-2.5 items-center justify-center rounded-full ${getExplorerGitToneClassName(state)}`}
        >
          <span className="absolute inset-0 rounded-full border border-current/80" />
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ))}
    </span>
  );
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
            <WorkspaceFolderIcon name={value || 'new_folder'} isOpen={Boolean(isExpanded)} className="h-4 w-4" />
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
          spellCheck={false}
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
