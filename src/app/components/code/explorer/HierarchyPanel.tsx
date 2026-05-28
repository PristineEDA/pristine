import { memo, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { AlertCircle, Box, ChevronDown, ChevronRight, EthernetPort, ListTree, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModuleHierarchy, type ModuleHierarchyTop } from '../../../context/ModuleHierarchyContext';
import { getPathBaseName } from '../../../workspace/workspaceFiles';
import type { LspModuleHierarchy, LspModuleHierarchyNode } from '../../../../../types/systemverilog-lsp';
import { ExplorerContextMenu, createContextMenuItem, type ExplorerContextMenuEntry } from './FileTreeNodeContextMenu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';

interface HierarchyPanelProps {
  activeFileId: string;
  isVisible: boolean;
  refreshToken?: number;
  workspaceAvailable: boolean | null;
  onFileOpen: (fileId: string, fileName: string) => void;
  onLineJump: (line: number) => void;
}

type HierarchyLoadState = 'idle' | 'loading' | 'ready' | 'error';
type HierarchyTopKind = 'auto' | 'manual';

interface HierarchyRootEntry {
  node: LspModuleHierarchyNode;
  originalIndex: number;
  rootKey: string;
  levelCount: number;
  totalNodeCount: number;
  fileName: string;
  definitionLine: number;
  topKind?: HierarchyTopKind;
}

interface HierarchyContextMenuState {
  rootKey: string;
  x: number;
  y: number;
}

const MODULE_HIERARCHY_MAX_DEPTH = 64;

function sanitizeTestIdPart(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'node';
}

function getNodePathKey(pathSegments: string[]) {
  return pathSegments.map(sanitizeTestIdPart).join('__');
}

function getNodeLabel(node: LspModuleHierarchyNode) {
  return node.instanceName ?? node.moduleName;
}

function getNodeTitle(node: LspModuleHierarchyNode) {
  const label = getNodeLabel(node);
  return node.instanceName ? `${label} (${node.moduleName})` : label;
}

function getNodeLine(node: LspModuleHierarchyNode) {
  const line = node.instanceSelectionRange?.start.line
    ?? node.moduleSelectionRange?.start.line
    ?? node.selectionRange?.start.line
    ?? node.range?.start.line;

  return typeof line === 'number' ? line + 1 : null;
}

function getDefaultExpandedKeys(nodes: LspModuleHierarchyNode[]) {
  const expandedKeys = new Set<string>();

  nodes.forEach((node, index) => {
    if (node.children.length > 0) {
      expandedKeys.add(getNodePathKey([`${index}:${node.moduleName}`]));
    }
  });

  return expandedKeys;
}

function isNavigationEnabled(node: LspModuleHierarchyNode) {
  return Boolean(node.filePath && !node.unresolved);
}

function getNodeKindLabel(node: LspModuleHierarchyNode) {
  return node.kind === 'interface' ? 'Interface' : 'Module';
}

function getNodeStatusTestId(nodeKey: string, status: 'unresolved' | 'cycle' | 'truncated') {
  return `hierarchy-node-status-${status}-${nodeKey}`;
}

function getNodeDefinitionLine(node: LspModuleHierarchyNode) {
  const line = node.moduleSelectionRange?.start.line
    ?? node.selectionRange?.start.line
    ?? node.range?.start.line;

  return typeof line === 'number' ? line : Number.MAX_SAFE_INTEGER;
}

function getHierarchyNodeLevelCount(node: LspModuleHierarchyNode): number {
  if (node.children.length === 0) {
    return 1;
  }

  return 1 + Math.max(...node.children.map(getHierarchyNodeLevelCount));
}

function getHierarchyNodeTotalCount(node: LspModuleHierarchyNode): number {
  return 1 + node.children.reduce((totalCount, child) => totalCount + getHierarchyNodeTotalCount(child), 0);
}

function getHierarchyRootFileName(node: LspModuleHierarchyNode) {
  const sourcePath = node.filePath ?? node.uri;
  return sourcePath ? getPathBaseName(sourcePath) : '';
}

function getHierarchyRootKey(node: LspModuleHierarchyNode, originalIndex: number) {
  const locationKey = node.filePath ?? node.uri ?? `root:${originalIndex}`;
  const definitionLine = getNodeDefinitionLine(node);
  const definitionKey = definitionLine === Number.MAX_SAFE_INTEGER ? 'line:unknown' : `line:${definitionLine}`;

  return [node.moduleName, node.instanceName ?? 'root', locationKey, definitionKey].join('|');
}

function createHierarchyRootEntry(node: LspModuleHierarchyNode, originalIndex: number): HierarchyRootEntry {
  return {
    node,
    originalIndex,
    rootKey: getHierarchyRootKey(node, originalIndex),
    levelCount: getHierarchyNodeLevelCount(node),
    totalNodeCount: getHierarchyNodeTotalCount(node),
    fileName: getHierarchyRootFileName(node),
    definitionLine: getNodeDefinitionLine(node),
  };
}

function compareRootFileNames(left: string, right: string) {
  if (left && right) {
    if (left < right) {
      return -1;
    }

    if (left > right) {
      return 1;
    }

    return 0;
  }

  if (left) {
    return -1;
  }

  if (right) {
    return 1;
  }

  return 0;
}

function compareHierarchyRootEntries(left: HierarchyRootEntry, right: HierarchyRootEntry) {
  const levelDifference = right.levelCount - left.levelCount;
  if (levelDifference !== 0) {
    return levelDifference;
  }

  const nodeCountDifference = right.totalNodeCount - left.totalNodeCount;
  if (nodeCountDifference !== 0) {
    return nodeCountDifference;
  }

  const fileNameDifference = compareRootFileNames(left.fileName, right.fileName);
  if (fileNameDifference !== 0) {
    return fileNameDifference;
  }

  const definitionLineDifference = left.definitionLine - right.definitionLine;
  if (definitionLineDifference !== 0) {
    return definitionLineDifference;
  }

  return left.originalIndex - right.originalIndex;
}

function getOrderedHierarchyRoots(rootEntries: HierarchyRootEntry[], manualTopRootKey: string | null) {
  const sortedEntries = [...rootEntries].sort(compareHierarchyRootEntries);

  if (manualTopRootKey) {
    const manualTopIndex = sortedEntries.findIndex((entry) => entry.rootKey === manualTopRootKey);
    if (manualTopIndex !== -1) {
      const manualTopEntry = sortedEntries[manualTopIndex];
      if (manualTopEntry) {
        return [
          { ...manualTopEntry, topKind: 'manual' as const },
          ...sortedEntries
            .filter((_, index) => index !== manualTopIndex)
            .map((entry) => ({ ...entry, topKind: undefined })),
        ];
      }
    }
  }

  return sortedEntries.map((entry, index) => ({
    ...entry,
    topKind: index === 0 ? 'auto' as const : undefined,
  }));
}

export function HierarchyPanel({
  activeFileId,
  isVisible,
  refreshToken = 0,
  workspaceAvailable,
  onFileOpen,
  onLineJump,
}: HierarchyPanelProps) {
  const [state, setState] = useState<HierarchyLoadState>('idle');
  const [hierarchy, setHierarchy] = useState<LspModuleHierarchy>({ roots: [], messages: [] });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const [manualTopRootKey, setManualTopRootKey] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<HierarchyContextMenuState | null>(null);
  const treeRef = useRef<HTMLDivElement | null>(null);
  const { setTop: setHierarchyTop } = useModuleHierarchy();

  const loadHierarchy = useCallback(async (abortSignal?: AbortSignal) => {
    if (workspaceAvailable === null) {
      setState('loading');
      setErrorMessage(null);
      return;
    }

    if (!workspaceAvailable) {
      setState('ready');
      setHierarchy({ roots: [], messages: ['Workspace is unavailable.'] });
      setErrorMessage(null);
      setExpandedKeys(new Set());
      return;
    }

    const lsp = window.electronAPI?.lsp;
    if (!lsp?.moduleHierarchy) {
      setState('error');
      setErrorMessage('SystemVerilog hierarchy service is unavailable.');
      setHierarchy({ roots: [], messages: [] });
      setExpandedKeys(new Set());
      return;
    }

    setState('loading');
    setErrorMessage(null);

    try {
      const nextHierarchy = await lsp.moduleHierarchy({ maxDepth: MODULE_HIERARCHY_MAX_DEPTH });
      if (abortSignal?.aborted) {
        return;
      }

      setHierarchy(nextHierarchy);
      setExpandedKeys(getDefaultExpandedKeys(nextHierarchy.roots));
      setState('ready');
    } catch (error) {
      if (abortSignal?.aborted) {
        return;
      }

      setHierarchy({ roots: [], messages: [] });
      setExpandedKeys(new Set());
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setState('error');
    }
  }, [workspaceAvailable]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const controller = new AbortController();
    void loadHierarchy(controller.signal);

    return () => {
      controller.abort();
    };
  }, [isVisible, loadHierarchy, refreshToken]);

  const handleToggleNode = useCallback((nodeKey: string) => {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }

      return next;
    });
  }, []);

  const handleOpenNode = useCallback((node: LspModuleHierarchyNode) => {
    if (!isNavigationEnabled(node) || !node.filePath) {
      return;
    }

    onFileOpen(node.filePath, getPathBaseName(node.filePath));
    const line = getNodeLine(node);
    if (line !== null) {
      onLineJump(line);
    }
  }, [onFileOpen, onLineJump]);

  const hasMessages = hierarchy.messages.length > 0;
  const activeModuleHint = useMemo(() => getPathBaseName(activeFileId), [activeFileId]);
  const rootEntries = useMemo(() => hierarchy.roots.map(createHierarchyRootEntry), [hierarchy.roots]);
  const orderedRoots = useMemo(() => getOrderedHierarchyRoots(rootEntries, manualTopRootKey), [manualTopRootKey, rootEntries]);
  const activeHierarchyTop = useMemo<ModuleHierarchyTop | null>(() => {
    const entry = orderedRoots[0];

    if (!entry) {
      return null;
    }

    return {
      rootKey: entry.rootKey,
      moduleName: entry.node.moduleName,
      instanceName: entry.node.instanceName,
      filePath: entry.node.filePath,
      uri: entry.node.uri,
      kind: entry.topKind ?? 'auto',
    };
  }, [orderedRoots]);

  useEffect(() => {
    setHierarchyTop(activeHierarchyTop);
  }, [activeHierarchyTop, setHierarchyTop]);

  useEffect(() => {
    if (!manualTopRootKey) {
      return;
    }

    if (!rootEntries.some((entry) => entry.rootKey === manualTopRootKey)) {
      setManualTopRootKey(null);
    }
  }, [manualTopRootKey, rootEntries]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    if (!rootEntries.some((entry) => entry.rootKey === contextMenu.rootKey)) {
      setContextMenu(null);
    }
  }, [contextMenu, rootEntries]);

  const handleOpenRootContextMenu = useCallback((rootKey: string, event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    treeRef.current?.focus();
    setContextMenu({
      rootKey,
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const handleSetManualTopRoot = useCallback((rootKey: string) => {
    setManualTopRootKey(rootKey);
    setContextMenu(null);
  }, []);

  const contextMenuItems = useMemo<ExplorerContextMenuEntry[]>(() => {
    if (!contextMenu) {
      return [];
    }

    return [
      createContextMenuItem({
        label: 'Set as Simulation Top',
        action: () => handleSetManualTopRoot(contextMenu.rootKey),
      }),
    ];
  }, [contextMenu, handleSetManualTopRoot]);

  const handleRequestTreeFocus = useCallback(() => {
    treeRef.current?.focus();
  }, []);

  if (state === 'loading' || state === 'idle') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 text-[12px] text-ide-text-muted">
        <Loader2 className="mr-2 size-3 animate-spin" aria-hidden="true" />
        <span data-testid="hierarchy-loading">Loading hierarchy</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-3 py-3 text-[12px] text-ide-text-muted">
        <div className="flex items-start gap-2 text-ide-error" role="alert">
          <AlertCircle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          <span data-testid="hierarchy-error" className="min-w-0 break-words">{errorMessage}</span>
        </div>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-ide-text-muted hover:bg-ide-hover hover:text-ide-text"
          aria-label="Reload module hierarchy"
          title="Reload module hierarchy"
          onClick={() => { void loadHierarchy(); }}
        >
          <RefreshCw className="size-3" aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (hierarchy.roots.length === 0) {
    return (
      <div
        data-testid="left-panel-secondary-placeholder"
        className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 text-center text-[12px] text-ide-text-muted"
      >
        {hasMessages ? hierarchy.messages.join(' ') : activeModuleHint ? 'Hierarchy is empty' : 'Hierarchy is empty'}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          ref={treeRef}
          data-testid="hierarchy-tree"
          className="min-h-0 flex-1 overflow-auto py-1 outline-none"
          role="tree"
          aria-label="Module hierarchy"
          tabIndex={0}
        >
          {orderedRoots.map(({ node, originalIndex, rootKey, topKind }) => (
            <HierarchyTreeNode
              key={rootKey}
              depth={0}
              expandedKeys={expandedKeys}
              node={node}
              pathSegments={[`${originalIndex}:${node.moduleName}`]}
              rootKey={rootKey}
              topKind={topKind}
              onOpenNode={handleOpenNode}
              onRootContextMenu={handleOpenRootContextMenu}
              onToggleNode={handleToggleNode}
            />
          ))}
        </div>
        {contextMenu && (
          <ExplorerContextMenu
            items={contextMenuItems}
            onClose={() => setContextMenu(null)}
            onRequestTreeFocus={handleRequestTreeFocus}
            x={contextMenu.x}
            y={contextMenu.y}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

interface HierarchyTreeNodeProps {
  depth: number;
  expandedKeys: Set<string>;
  node: LspModuleHierarchyNode;
  pathSegments: string[];
  rootKey?: string;
  topKind?: HierarchyTopKind;
  onOpenNode: (node: LspModuleHierarchyNode) => void;
  onRootContextMenu?: (rootKey: string, event: ReactMouseEvent<HTMLDivElement>) => void;
  onToggleNode: (nodeKey: string) => void;
}

const HierarchyTreeNode = memo(function HierarchyTreeNode({
  depth,
  expandedKeys,
  node,
  pathSegments,
  rootKey,
  topKind,
  onOpenNode,
  onRootContextMenu,
  onToggleNode,
}: HierarchyTreeNodeProps) {
  const nodeKey = getNodePathKey(pathSegments);
  const hasChildren = node.children.length > 0;
  const expanded = expandedKeys.has(nodeKey);
  const line = getNodeLine(node);
  const canNavigate = isNavigationEnabled(node);
  const label = getNodeLabel(node);
  const title = getNodeTitle(node);
  const kindLabel = getNodeKindLabel(node);
  const labelTooltip = node.filePath ?? title;
  const statusLabel = node.cycle ? 'cycle' : node.truncated ? 'truncated' : null;
  const unresolvedStatusLabel = `Unresolved ${kindLabel.toLowerCase()} ${node.moduleName}`;
  const topLabel = topKind === 'manual' ? 'Manual top module' : topKind === 'auto' ? 'Automatic top module' : null;

  const handleContextMenu = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!rootKey) {
      return;
    }

    onRootContextMenu?.(rootKey, event);
  }, [onRootContextMenu, rootKey]);

  const labelButton = (
    <button
      type="button"
      data-testid={`hierarchy-node-label-${sanitizeTestIdPart(node.moduleName)}-${sanitizeTestIdPart(node.instanceName ?? 'root')}`}
      className={cn(
        'ml-1 flex min-w-0 flex-1 items-center text-left text-[13px] font-normal',
        topKind && 'font-semibold',
        canNavigate ? 'cursor-pointer hover:text-ide-accent' : 'cursor-default',
      )}
      disabled={!canNavigate}
      onDoubleClick={() => onOpenNode(node)}
    >
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );

  return (
    <div role="none">
      <div
        data-testid={`hierarchy-node-${nodeKey}`}
        className="group flex h-6 min-w-0 items-center gap-1 pr-2 text-ide-text hover:bg-ide-hover"
        style={{ paddingLeft: depth * 12 + 4 }}
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
        onContextMenu={depth === 0 ? handleContextMenu : undefined}
      >
        {hasChildren ? (
          <button
            type="button"
            className="inline-flex shrink-0 items-center justify-center text-ide-text-muted hover:text-ide-text"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
            onClick={() => onToggleNode(nodeKey)}
          >
            {expanded ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" aria-hidden="true" />
        )}

        <span
          data-testid={node.unresolved ? getNodeStatusTestId(nodeKey, 'unresolved') : `hierarchy-node-icon-${nodeKey}`}
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center',
            node.unresolved ? 'text-ide-warning' : node.kind === 'interface' ? 'text-ide-syntax-function' : 'text-ide-syntax-keyword',
          )}
          aria-label={node.unresolved ? unresolvedStatusLabel : `${kindLabel} ${node.moduleName}`}
          role="img"
        >
          {node.unresolved ? (
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          ) : node.kind === 'interface' ? (
            <EthernetPort className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Box className="h-4 w-4" aria-hidden="true" />
          )}
        </span>

        {topLabel && (
          <span
            data-testid={`hierarchy-node-top-indicator-${nodeKey}`}
            className="flex h-4 w-4 shrink-0 items-center justify-center text-ide-accent"
            aria-label={topLabel}
            role="img"
          >
            <ListTree className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        )}

        {canNavigate ? (
          <Tooltip>
            <TooltipTrigger asChild>{labelButton}</TooltipTrigger>
            <TooltipContent
              align="start"
              className="max-w-[min(34rem,calc(100vw-2rem))] rounded-none bg-ide-bg px-3 py-1.5 text-[12px] text-ide-text shadow-none"
              data-testid="hierarchy-node-tooltip"
              showArrow={false}
              side="bottom"
              sideOffset={2}
              style={{
                backgroundColor: 'var(--ide-bg, var(--popover, #181818))',
                border: '1px solid color-mix(in srgb, var(--ide-border-light, var(--ide-border)) 65%, var(--ide-text-muted) 35%)',
                opacity: 1,
              }}
            >
              {labelTooltip}
            </TooltipContent>
          </Tooltip>
        ) : labelButton}

        {statusLabel && (
          <span data-testid={getNodeStatusTestId(nodeKey, statusLabel)} className="shrink-0 text-[10px] text-ide-text-muted">{statusLabel}</span>
        )}

        {line !== null && (
          <button
            type="button"
            className="shrink-0 text-[10px] text-ide-text-muted opacity-0 hover:text-ide-text group-hover:opacity-100"
            aria-label={`Open ${label} at line ${line}`}
            disabled={!canNavigate}
            onClick={() => onOpenNode(node)}
          >
            :{line}
          </button>
        )}
      </div>

      {hasChildren && expanded && node.children.map((child, index) => (
        <HierarchyTreeNode
          key={`${index}:${child.moduleName}:${child.instanceName ?? ''}`}
          depth={depth + 1}
          expandedKeys={expandedKeys}
          node={child}
          pathSegments={[...pathSegments, `${index}:${child.instanceName ?? child.moduleName}`]}
          onOpenNode={onOpenNode}
          onRootContextMenu={onRootContextMenu}
          onToggleNode={onToggleNode}
        />
      ))}
    </div>
  );
});
