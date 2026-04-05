import { useState, memo } from 'react';
import {
  ChevronRight, ChevronDown, Circle,
  Box, Zap, GitMerge, Code2, Hash,
} from 'lucide-react';
import { OutlineItem } from '../../data/mockData';

// ─── Outline Icon ─────────────────────────────────────────────────────────────
export function OutlineIcon({ type }: { type: OutlineItem['type'] }) {
  switch (type) {
    case 'module': return <Box size={13} className="text-ide-syntax-keyword" />;
    case 'input': return <span className="text-emerald-500 text-[10px] font-bold font-mono">I</span>;
    case 'output': return <span className="text-ide-syntax-function text-[10px] font-bold font-mono">O</span>;
    case 'inout': return <span className="text-blue-400 text-[10px] font-bold font-mono">IO</span>;
    case 'wire': return <span className="text-blue-400 text-[10px] font-bold">W</span>;
    case 'reg': return <span className="text-destructive text-[10px] font-bold">R</span>;
    case 'always': return <Zap size={12} className="text-ide-syntax-function" />;
    case 'fsm': return <GitMerge size={12} className="text-ide-syntax-string" />;
    case 'function': return <Code2 size={12} className="text-emerald-500" />;
    case 'task': return <Code2 size={12} className="text-ide-syntax-keyword" />;
    case 'parameter': return <Hash size={12} className="text-ide-syntax-number" />;
    case 'localparam': return <Hash size={12} className="text-ide-syntax-number" />;
    default: return <Circle size={10} className="text-muted-foreground" />;
  }
}

// ─── Recursive Outline Node ───────────────────────────────────────────────────
export const OutlineNode = memo(function OutlineNode({
  item, depth, onLineJump,
}: { item: OutlineItem; depth: number; onLineJump: (l: number) => void }) {
  const [expanded, setExpanded] = useState(item.expanded !== false);

  return (
    <div>
      <div
        className="flex items-center gap-1 h-6 cursor-pointer hover:bg-accent transition-colors text-foreground"
        style={{ paddingLeft: depth * 12 + 6 }}
        onClick={() => {
          if (item.children) setExpanded(!expanded);
          else onLineJump(item.line);
        }}
      >
        {item.children ? (
          <span className="text-muted-foreground">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : (
          <span className="w-3" />
        )}
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          <OutlineIcon type={item.type} />
        </span>
        <span className="text-[12px] flex-1 truncate ml-0.5">{item.name}</span>
        {item.detail && (
          <span className="text-[11px] text-muted-foreground pr-2 truncate max-w-20">{item.detail}</span>
        )}
        <span className="text-[10px] text-muted-foreground pr-2 opacity-0 hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onLineJump(item.line); }}
        >
          :{item.line}
        </span>
      </div>
      {item.children && expanded && item.children.map((child) => (
        <OutlineNode key={child.id} item={child} depth={depth + 1} onLineJump={onLineJump} />
      ))}
    </div>
  );
});
