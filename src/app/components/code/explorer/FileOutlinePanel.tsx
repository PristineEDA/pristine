import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import type { LspOutlineItem, LspOutlineResult } from '../../../../../types/systemverilog-lsp';
import { systemVerilogLspBridge, type SystemVerilogDocumentSyncEvent } from '../../../lsp/systemVerilogLspBridge';
import { getEditorLanguage, getPathBaseName, normalizeWorkspacePath } from '../../../workspace/workspaceFiles';
import {
  createPlainOutlineNode,
  getOutlineNodeKey,
  OutlineNode,
  type OutlineTreeNode,
} from './OutlineNode';

const OUTLINE_MAX_DEPTH = 8;
const OUTLINE_LIMIT = 2000;
const OUTLINE_REFRESH_DEBOUNCE_MS = 160;

type OutlineLoadState = 'idle' | 'loading' | 'ready' | 'error';

function createEmptyOutline(filePath = ''): LspOutlineResult {
  return {
    uri: '',
    filePath,
    version: 0,
    generation: 0,
    roots: [],
    items: [],
    partial: false,
    truncated: false,
    messages: [],
  };
}

function createGroupedOutlineChildren(items: LspOutlineItem[], parentId: string): OutlineTreeNode[] {
  const groups = new Map<string, OutlineTreeNode[]>();

  items.forEach((item) => {
    const groupItems = groups.get(item.kind) ?? [];
    groupItems.push(createPlainOutlineNode(item));
    groups.set(item.kind, groupItems);
  });

  return [...groups.entries()].map(([kind, children]) => ({
    type: 'kind-group',
    id: `${parentId}:kind:${kind}`,
    kind,
    children,
  }));
}

function createRootOutlineNode(item: LspOutlineItem): OutlineTreeNode {
  return {
    type: 'item',
    item,
    children: createGroupedOutlineChildren(item.children, item.id),
  };
}

function getOutlineTreeNodeStableId(node: OutlineTreeNode) {
  return node.type === 'item' ? `${node.item.id}:${node.item.name}` : node.id;
}

function collectDefaultExpandedKeys(
  nodes: OutlineTreeNode[],
  expandedKeys: Set<string>,
  pathSegments: string[] = [],
) {
  nodes.forEach((node, index) => {
    const nextPathSegments = [...pathSegments, `${index}:${getOutlineTreeNodeStableId(node)}`];
    if (node.children.length > 0) {
      expandedKeys.add(getOutlineNodeKey(nextPathSegments));
      collectDefaultExpandedKeys(node.children, expandedKeys, nextPathSegments);
    }
  });
}

function getDefaultExpandedKeys(nodes: OutlineTreeNode[]) {
  const expandedKeys = new Set<string>();

  collectDefaultExpandedKeys(nodes, expandedKeys);

  return expandedKeys;
}

function isSystemVerilogOutlineFile(filePath: string) {
  return filePath.length > 0 && getEditorLanguage(filePath) === 'systemverilog';
}

interface FileOutlinePanelProps {
  currentOutlineId: string;
  onLineJump: (line: number) => void;
}

export function FileOutlinePanel({ currentOutlineId, onLineJump }: FileOutlinePanelProps) {
  const filePath = useMemo(() => normalizeWorkspacePath(currentOutlineId || ''), [currentOutlineId]);
  const displayName = currentOutlineId ? getPathBaseName(currentOutlineId) : '';
  const canRequestOutline = isSystemVerilogOutlineFile(filePath);
  const [state, setState] = useState<OutlineLoadState>('idle');
  const [outline, setOutline] = useState<LspOutlineResult>(() => createEmptyOutline(filePath));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set());
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeFilePathRef = useRef(filePath);
  const requestSequenceRef = useRef(0);
  const hasSyncedOpenDocumentRef = useRef(false);

  const loadOutline = useCallback(async (abortSignal?: AbortSignal) => {
    const requestFilePath = filePath;
    if (activeFilePathRef.current !== requestFilePath) {
      return;
    }

    const requestSequence = ++requestSequenceRef.current;
    if (!canRequestOutline) {
      setState('ready');
      setOutline(createEmptyOutline(requestFilePath));
      setErrorMessage(null);
      setExpandedKeys(new Set());
      return;
    }

    setState('loading');
    setErrorMessage(null);

    try {
      const nextOutline = await systemVerilogLspBridge.requestOutline(requestFilePath, {
        maxDepth: OUTLINE_MAX_DEPTH,
        limit: OUTLINE_LIMIT,
        includeChildren: true,
        includeFlat: true,
      });
      if (
        abortSignal?.aborted
        || activeFilePathRef.current !== requestFilePath
        || requestSequenceRef.current !== requestSequence
      ) {
        return;
      }

      const normalizedOutline = nextOutline ?? createEmptyOutline(requestFilePath);
      const nextOutlineNodes = normalizedOutline.roots.map(createRootOutlineNode);
      setOutline(normalizedOutline);
      setExpandedKeys(getDefaultExpandedKeys(nextOutlineNodes));
      setState('ready');
    } catch (error) {
      if (
        abortSignal?.aborted
        || activeFilePathRef.current !== requestFilePath
        || requestSequenceRef.current !== requestSequence
      ) {
        return;
      }

      setOutline(createEmptyOutline(requestFilePath));
      setExpandedKeys(new Set());
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setState('error');
    }
  }, [canRequestOutline, filePath]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void loadOutline();
    }, OUTLINE_REFRESH_DEBOUNCE_MS);
  }, [loadOutline]);

  useEffect(() => {
    activeFilePathRef.current = filePath;
    requestSequenceRef.current += 1;
    hasSyncedOpenDocumentRef.current = false;
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (!canRequestOutline) {
      setState('ready');
      setOutline(createEmptyOutline(filePath));
      setErrorMessage(null);
      setExpandedKeys(new Set());
      return;
    }

    setState('loading');
    setErrorMessage(null);
  }, [canRequestOutline, filePath]);

  useEffect(() => {
    if (!canRequestOutline) {
      return;
    }

    scheduleRefresh();
    const handleDocumentSync = (event: SystemVerilogDocumentSyncEvent) => {
      if (normalizeWorkspacePath(event.filePath) !== filePath) {
        return;
      }

      if (event.kind === 'close') {
        hasSyncedOpenDocumentRef.current = false;
        return;
      }

      hasSyncedOpenDocumentRef.current = true;
      scheduleRefresh();
    };

    const unsubscribe = systemVerilogLspBridge.subscribeToDocumentSyncEvents(handleDocumentSync);
    if (hasSyncedOpenDocumentRef.current) {
      scheduleRefresh();
    }

    return () => {
      unsubscribe();
    };
  }, [canRequestOutline, filePath, scheduleRefresh]);

  useEffect(() => () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

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
  const outlineNodes = useMemo(() => outline.roots.map(createRootOutlineNode), [outline.roots]);

  if (!currentOutlineId) {
    return (
      <div
        data-testid="outline-empty"
        className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 text-center text-[12px] text-ide-text-muted"
      >
        No file open
      </div>
    );
  }

  if (!canRequestOutline) {
    return (
      <div
        data-testid="outline-empty"
        className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 text-center text-[12px] text-ide-text-muted"
      >
        No SystemVerilog outline available
      </div>
    );
  }

  if (state === 'loading' || state === 'idle') {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 text-[12px] text-ide-text-muted">
        <Loader2 className="mr-2 size-3 animate-spin" aria-hidden="true" />
        <span data-testid="outline-loading">Loading outline</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-3 py-3 text-[12px] text-ide-text-muted">
        <div className="flex items-start gap-2 text-ide-error" role="alert">
          <AlertCircle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          <span data-testid="outline-error" className="min-w-0 break-words">{errorMessage}</span>
        </div>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-ide-text-muted hover:bg-ide-hover hover:text-ide-text"
          aria-label="Reload outline"
          title="Reload outline"
          onClick={() => { void loadOutline(); }}
        >
          <RefreshCw className="size-3" aria-hidden="true" />
        </button>
      </div>
    );
  }

  const hasMessages = outline.messages.length > 0 || outline.partial || outline.truncated;
  const statusMessage = [
    ...outline.messages,
    outline.partial ? 'Outline is partial.' : '',
    outline.truncated ? 'Outline was truncated.' : '',
  ].filter(Boolean).join(' ');

  if (outline.roots.length === 0) {
    return (
      <div
        data-testid="outline-empty"
        className="flex min-h-0 flex-1 items-center justify-center px-3 py-2 text-center text-[12px] text-ide-text-muted"
      >
        {statusMessage || `No outline symbols in ${displayName}`}
      </div>
    );
  }

  return (
    <div
      data-testid="outline-panel"
      data-outline-file={filePath}
      data-outline-partial={String(outline.partial)}
      data-outline-truncated={String(outline.truncated)}
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {hasMessages && (
        <div
          data-testid="outline-messages"
          className="shrink-0 border-b border-ide-border/60 px-3 py-1.5 text-[11px] leading-4 text-ide-text-muted"
        >
          {statusMessage}
        </div>
      )}
      <div
        data-testid="outline-tree"
        className="min-h-0 flex-1 overflow-auto py-1 outline-none"
        role="tree"
        aria-label={`Outline for ${displayName}`}
        tabIndex={0}
      >
        {outlineNodes.map((node, index) => (
          <OutlineNode
            key={getOutlineTreeNodeStableId(node)}
            depth={0}
            expandedKeys={expandedKeys}
            node={node}
            onLineJump={onLineJump}
            onToggleNode={handleToggleNode}
            pathSegments={[`${index}:${getOutlineTreeNodeStableId(node)}`]}
          />
        ))}
      </div>
    </div>
  );
}
