import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Box, ChevronDown, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPathBaseName } from '../../../workspace/workspaceFiles';
import type { LspModuleHierarchy, LspModuleHierarchyNode } from '../../../../../types/systemverilog-lsp';

interface HierarchyPanelProps {
  activeFileId: string;
  isVisible: boolean;
  refreshToken?: number;
  workspaceAvailable: boolean | null;
  onFileOpen: (fileId: string, fileName: string) => void;
  onLineJump: (line: number) => void;
}

type HierarchyLoadState = 'idle' | 'loading' | 'ready' | 'error';

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

function getNodeStatusTestId(nodeKey: string, status: 'unresolved' | 'cycle' | 'truncated') {
  return `hierarchy-node-status-${status}-${nodeKey}`;
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
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-7 shrink-0 items-center justify-between px-2 text-[11px] text-ide-text-muted">
        <span className="truncate uppercase">Modules</span>
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-ide-hover hover:text-ide-text"
          aria-label="Reload module hierarchy"
          title="Reload module hierarchy"
          onClick={() => { void loadHierarchy(); }}
        >
          <RefreshCw className="size-3" aria-hidden="true" />
        </button>
      </div>
      <div data-testid="hierarchy-tree" className="min-h-0 flex-1 overflow-auto py-1" role="tree" aria-label="Module hierarchy">
        {hierarchy.roots.map((node, index) => (
          <HierarchyTreeNode
            key={`${index}:${node.moduleName}`}
            depth={0}
            expandedKeys={expandedKeys}
            node={node}
            pathSegments={[`${index}:${node.moduleName}`]}
            onOpenNode={handleOpenNode}
            onToggleNode={handleToggleNode}
          />
        ))}
      </div>
    </div>
  );
}

interface HierarchyTreeNodeProps {
  depth: number;
  expandedKeys: Set<string>;
  node: LspModuleHierarchyNode;
  pathSegments: string[];
  onOpenNode: (node: LspModuleHierarchyNode) => void;
  onToggleNode: (nodeKey: string) => void;
}

const HierarchyTreeNode = memo(function HierarchyTreeNode({
  depth,
  expandedKeys,
  node,
  pathSegments,
  onOpenNode,
  onToggleNode,
}: HierarchyTreeNodeProps) {
  const nodeKey = getNodePathKey(pathSegments);
  const hasChildren = node.children.length > 0;
  const expanded = expandedKeys.has(nodeKey);
  const line = getNodeLine(node);
  const canNavigate = isNavigationEnabled(node);
  const label = getNodeLabel(node);
  const title = getNodeTitle(node);
  const statusLabel = node.cycle ? 'cycle' : node.truncated ? 'truncated' : null;
  const unresolvedStatusLabel = `Unresolved module ${node.moduleName}`;

  return (
    <div role="none">
      <div
        data-testid={`hierarchy-node-${nodeKey}`}
        className="group flex h-6 min-w-0 items-center gap-1 pr-2 text-ide-text hover:bg-ide-hover"
        style={{ paddingLeft: depth * 12 + 4 }}
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
      >
        {hasChildren ? (
          <button
            type="button"
            className="inline-flex shrink-0 items-center justify-center text-ide-text-muted hover:text-ide-text"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
            title={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
            onClick={() => onToggleNode(nodeKey)}
          >
            {expanded ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" aria-hidden="true" />
        )}

        <span
          data-testid={node.unresolved ? getNodeStatusTestId(nodeKey, 'unresolved') : undefined}
          className={cn(
            'flex h-4 w-4 shrink-0 items-center justify-center',
            node.unresolved ? 'text-ide-error' : 'text-ide-syntax-keyword',
          )}
          aria-label={node.unresolved ? unresolvedStatusLabel : undefined}
          title={node.unresolved ? unresolvedStatusLabel : undefined}
          role={node.unresolved ? 'img' : undefined}
        >
          {node.unresolved ? (
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Box className="h-4 w-4" aria-hidden="true" />
          )}
        </span>

        <button
          type="button"
          data-testid={`hierarchy-node-label-${sanitizeTestIdPart(node.moduleName)}-${sanitizeTestIdPart(node.instanceName ?? 'root')}`}
          className={cn(
            'ml-1 flex min-w-0 flex-1 items-center text-left text-[13px] font-normal',
            canNavigate ? 'cursor-pointer hover:text-ide-accent' : 'cursor-default',
          )}
          disabled={!canNavigate}
          title={canNavigate && node.filePath ? `${title} - ${node.filePath}` : title}
          onClick={() => onOpenNode(node)}
        >
          <span className="min-w-0 truncate">{label}</span>
        </button>

        {statusLabel && (
          <span data-testid={getNodeStatusTestId(nodeKey, statusLabel)} className="shrink-0 text-[10px] text-ide-text-muted">{statusLabel}</span>
        )}

        {line !== null && (
          <button
            type="button"
            className="shrink-0 text-[10px] text-ide-text-muted opacity-0 hover:text-ide-text group-hover:opacity-100"
            aria-label={`Open ${label} at line ${line}`}
            title={`Line ${line}`}
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
          onToggleNode={onToggleNode}
        />
      ))}
    </div>
  );
});
