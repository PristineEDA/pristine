import { memo, useCallback } from 'react';
import {
  Blocks,
  Braces,
  Cable,
  ChevronDown,
  ChevronRight,
  Circle,
  CircuitBoard,
  Component,
  FunctionSquare,
  Hash,
  Package,
  Variable,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LspOutlineItem } from '../../../../../types/systemverilog-lsp';

export function sanitizeOutlineTestIdPart(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'outline';
}

export function getOutlineNodeKey(pathSegments: string[]) {
  return pathSegments.map(sanitizeOutlineTestIdPart).join('__');
}

function getOutlineKindLabel(kind: string) {
  return kind
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());
}

export function getOutlineLine(item: LspOutlineItem) {
  const line = item.selectionRange?.start.line ?? item.range?.start.line;
  return typeof line === 'number' ? line + 1 : null;
}

export function OutlineIcon({ kind }: { kind: string }) {
  switch (kind) {
    case 'module':
      return <CircuitBoard className="h-4 w-4 text-ide-syntax-keyword" aria-hidden="true" />;
    case 'interface':
      return <Cable className="h-4 w-4 text-ide-info" aria-hidden="true" />;
    case 'package':
      return <Package className="h-4 w-4 text-ide-syntax-string" aria-hidden="true" />;
    case 'class':
      return <Braces className="h-4 w-4 text-ide-syntax-function" aria-hidden="true" />;
    case 'function':
    case 'task':
      return <FunctionSquare className="h-3.5 w-3.5 text-ide-success" aria-hidden="true" />;
    case 'parameter':
    case 'localparam':
    case 'enumMember':
      return <Hash className="h-3.5 w-3.5 text-ide-syntax-number" aria-hidden="true" />;
    case 'variable':
    case 'net':
      return <Variable className="h-3.5 w-3.5 text-ide-syntax-function" aria-hidden="true" />;
    case 'instance':
      return <Component className="h-4 w-4 text-ide-syntax-keyword" aria-hidden="true" />;
    case 'generateBlock':
      return <Blocks className="h-4 w-4 text-ide-warning" aria-hidden="true" />;
    default:
      return <Circle className="h-2.5 w-2.5 text-ide-text-muted" aria-hidden="true" />;
  }
}

interface OutlineNodeProps {
  depth: number;
  expandedKeys: Set<string>;
  item: LspOutlineItem;
  onLineJump: (line: number) => void;
  onToggleNode: (nodeKey: string) => void;
  pathSegments: string[];
}

export const OutlineNode = memo(function OutlineNode({
  depth,
  expandedKeys,
  item,
  onLineJump,
  onToggleNode,
  pathSegments,
}: OutlineNodeProps) {
  const nodeKey = getOutlineNodeKey(pathSegments);
  const hasChildren = item.children.length > 0;
  const expanded = expandedKeys.has(nodeKey);
  const line = getOutlineLine(item);
  const kindLabel = getOutlineKindLabel(item.kind);
  const labelTestId = `outline-node-label-${sanitizeOutlineTestIdPart(item.kind)}-${sanitizeOutlineTestIdPart(item.name)}`;

  const handleOpen = useCallback(() => {
    if (line !== null) {
      onLineJump(line);
    }
  }, [line, onLineJump]);

  return (
    <div role="none">
      <div
        data-testid={`outline-node-${nodeKey}`}
        className="group flex h-6 min-w-0 items-center gap-1 pr-2 text-ide-text hover:bg-ide-hover"
        style={{ paddingLeft: depth * 12 + 4 }}
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
      >
        {hasChildren ? (
          <button
            type="button"
            className="inline-flex shrink-0 items-center justify-center text-ide-text-muted hover:text-ide-text"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.name}`}
            onClick={() => onToggleNode(nodeKey)}
          >
            {expanded ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" aria-hidden="true" />
        )}

        <span
          data-testid={`outline-node-icon-${nodeKey}`}
          className="flex h-4 w-4 shrink-0 items-center justify-center"
          aria-label={`${kindLabel} ${item.name}`}
          role="img"
        >
          <OutlineIcon kind={item.kind} />
        </span>

        <button
          type="button"
          data-testid={labelTestId}
          className={cn(
            'ml-1 flex min-w-0 flex-1 items-center text-left text-[13px] font-normal',
            line !== null ? 'cursor-pointer hover:text-ide-accent' : 'cursor-default',
          )}
          disabled={line === null}
          onDoubleClick={handleOpen}
        >
          <span className="min-w-0 truncate">{item.name}</span>
        </button>

        <span className="shrink-0 text-[10px] text-ide-text-muted opacity-0 group-hover:opacity-100">
          {kindLabel}
        </span>

        {line !== null && (
          <button
            type="button"
            className="shrink-0 text-[10px] text-ide-text-muted opacity-0 hover:text-ide-text group-hover:opacity-100"
            aria-label={`Open ${item.name} at line ${line}`}
            onClick={handleOpen}
          >
            :{line}
          </button>
        )}
      </div>

      {hasChildren && expanded && item.children.map((child, index) => (
        <OutlineNode
          key={child.id}
          depth={depth + 1}
          expandedKeys={expandedKeys}
          item={child}
          onLineJump={onLineJump}
          onToggleNode={onToggleNode}
          pathSegments={[...pathSegments, `${index}:${child.id}:${child.name}`]}
        />
      ))}
    </div>
  );
});
