import { useState, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, File, Folder, FolderOpen,
  FilePlus, FolderPlus, RefreshCw, ChevronsUpDown,
  AlertCircle, AlertTriangle, Info, Circle, MoreHorizontal,
  Box, Cpu, Zap, GitMerge, Code2, Hash, ArrowRight,
} from 'lucide-react';
import { FileNode, OutlineItem, Problem, initialFileTree, problemsList, fileOutlines } from '../../data/mockData';

interface LeftSidePanelProps {
  activeFileId: string;
  onFileOpen: (fileId: string, fileName: string) => void;
  onLineJump: (line: number) => void;
  currentOutlineId: string;
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
function ContextMenu({
  x, y, onClose, items,
}: { x: number; y: number; onClose: () => void; items: { label: string; action: () => void }[] }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed bg-[#252526] border border-[#454545] shadow-2xl z-50 py-1 min-w-44"
        style={{ left: x, top: y }}
      >
        {items.map((item, i) =>
          item.label === '---' ? (
            <div key={i} className="h-px bg-[#454545] my-1" />
          ) : (
            <button
              key={i}
              className="w-full text-left px-3 py-1 text-[#cccccc] hover:bg-[#094771] hover:text-white transition-colors"
              style={{ fontSize: '12px' }}
              onClick={() => { item.action(); onClose(); }}
            >
              {item.label}
            </button>
          )
        )}
      </div>
    </>
  );
}

// ─── File Icon ────────────────────────────────────────────────────────────────
function FileIcon({ name, language }: { name: string; language?: string }) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'v') return <span className="text-[#5fb3f6]" style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>V</span>;
  if (ext === 'sv') return <span className="text-[#a78bfa]" style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>SV</span>;
  if (ext === 'xdc') return <span className="text-[#f6a05f]" style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>X</span>;
  if (ext === 'yml' || ext === 'yaml') return <span className="text-[#ef9d3f]" style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>Y</span>;
  if (ext === 'md') return <span className="text-[#7ec8e3]" style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>M</span>;
  return <File size={13} className="text-[#cccccc]" />;
}

// ─── Outline Icon ─────────────────────────────────────────────────────────────
function OutlineIcon({ type }: { type: OutlineItem['type'] }) {
  switch (type) {
    case 'module': return <Box size={13} className="text-[#c586c0]" />;
    case 'input': return <span className="text-[#4ec9b0]" style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>I</span>;
    case 'output': return <span className="text-[#dcdcaa]" style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>O</span>;
    case 'inout': return <span className="text-[#9cdcfe]" style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }}>IO</span>;
    case 'wire': return <span className="text-[#9cdcfe]" style={{ fontSize: 10, fontWeight: 700 }}>W</span>;
    case 'reg': return <span className="text-[#f48771]" style={{ fontSize: 10, fontWeight: 700 }}>R</span>;
    case 'always': return <Zap size={12} className="text-[#dcdcaa]" />;
    case 'fsm': return <GitMerge size={12} className="text-[#ce9178]" />;
    case 'function': return <Code2 size={12} className="text-[#4ec9b0]" />;
    case 'task': return <Code2 size={12} className="text-[#c586c0]" />;
    case 'parameter': return <Hash size={12} className="text-[#b5cea8]" />;
    case 'localparam': return <Hash size={12} className="text-[#b5cea8]" />;
    default: return <Circle size={10} className="text-[#858585]" />;
  }
}

// ─── Recursive File Tree Node ─────────────────────────────────────────────────
function FileTreeNode({
  node,
  depth,
  activeFileId,
  onFileOpen,
  expandedFolders,
  onToggleFolder,
}: {
  node: FileNode;
  depth: number;
  activeFileId: string;
  onFileOpen: (id: string, name: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (id: string) => void;
}) {
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const isExpanded = expandedFolders.has(node.id);
  const isActive = node.id === activeFileId;

  const contextItems = node.type === 'folder'
    ? [
        { label: 'New File', action: () => {} },
        { label: 'New Folder', action: () => {} },
        { label: '---', action: () => {} },
        { label: 'Rename', action: () => {} },
        { label: 'Delete', action: () => {} },
        { label: '---', action: () => {} },
        { label: 'Set as Simulation Top', action: () => {} },
        { label: 'Copy Path', action: () => {} },
      ]
    : [
        { label: 'Open in Editor', action: () => onFileOpen(node.id, node.name) },
        { label: '---', action: () => {} },
        { label: 'Rename', action: () => {} },
        { label: 'Delete', action: () => {} },
        { label: '---', action: () => {} },
        { label: 'Set as Simulation Top', action: () => {} },
        { label: 'Copy Path', action: () => {} },
        { label: 'Copy Relative Path', action: () => {} },
      ];

  return (
    <div>
      <div
        className={`flex items-center gap-1 h-6 cursor-pointer group hover:bg-[#2a2d2e] transition-colors ${
          isActive ? 'bg-[#37373d] text-white' : 'text-[#cccccc]'
        }`}
        style={{ paddingLeft: depth * 12 + 4 }}
        onClick={() => {
          if (node.type === 'folder') onToggleFolder(node.id);
          else onFileOpen(node.id, node.name);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
      >
        {node.type === 'folder' ? (
          <>
            <span className="text-[#c5c5c5]">
              {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </span>
            {isExpanded
              ? <FolderOpen size={14} className="text-[#dcb67a] shrink-0" />
              : <Folder size={14} className="text-[#dcb67a] shrink-0" />}
            <span style={{ fontSize: '13px' }} className="flex-1 truncate ml-1">{node.name}</span>
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              <FileIcon name={node.name} language={node.language} />
            </span>
            <span style={{ fontSize: '13px' }} className="flex-1 truncate ml-1">{node.name}</span>
            {(node.hasError || node.hasWarning) && (
              <span className="flex items-center pr-1 shrink-0">
                {node.hasError && <AlertCircle size={11} className="text-[#f48771]" />}
                {!node.hasError && node.hasWarning && <AlertTriangle size={11} className="text-[#cca700]" />}
              </span>
            )}
          </>
        )}
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={contextItems}
        />
      )}

      {node.type === 'folder' && isExpanded && node.children?.map((child) => (
        <FileTreeNode
          key={child.id}
          node={child}
          depth={depth + 1}
          activeFileId={activeFileId}
          onFileOpen={onFileOpen}
          expandedFolders={expandedFolders}
          onToggleFolder={onToggleFolder}
        />
      ))}
    </div>
  );
}

// ─── Recursive Outline Node ───────────────────────────────────────────────────
function OutlineNode({
  item, depth, onLineJump,
}: { item: OutlineItem; depth: number; onLineJump: (l: number) => void }) {
  const [expanded, setExpanded] = useState(item.expanded !== false);

  return (
    <div>
      <div
        className="flex items-center gap-1 h-6 cursor-pointer hover:bg-[#2a2d2e] transition-colors text-[#cccccc]"
        style={{ paddingLeft: depth * 12 + 6 }}
        onClick={() => {
          if (item.children) setExpanded(!expanded);
          else onLineJump(item.line);
        }}
      >
        {item.children ? (
          <span className="text-[#c5c5c5]">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : (
          <span className="w-3" />
        )}
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          <OutlineIcon type={item.type} />
        </span>
        <span style={{ fontSize: '12px' }} className="flex-1 truncate ml-0.5">{item.name}</span>
        {item.detail && (
          <span style={{ fontSize: '11px' }} className="text-[#858585] pr-2 truncate max-w-20">{item.detail}</span>
        )}
        <span
          style={{ fontSize: '10px' }}
          className="text-[#858585] pr-2 opacity-0 hover:opacity-100"
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
}

// ─── Severity Badge ───────────────────────────────────────────────────────────
function SeverityIcon({ severity }: { severity: Problem['severity'] }) {
  if (severity === 'error') return <AlertCircle size={13} className="text-[#f48771] shrink-0" />;
  if (severity === 'warning') return <AlertTriangle size={13} className="text-[#cca700] shrink-0" />;
  if (severity === 'info') return <Info size={13} className="text-[#75beff] shrink-0" />;
  return <Circle size={10} className="text-[#858585] shrink-0" />;
}

// ─── Left Side Panel ──────────────────────────────────────────────────────────
export function LeftSidePanel({ activeFileId, onFileOpen, onLineJump, currentOutlineId }: LeftSidePanelProps) {
  const [tab, setTab] = useState<'explorer' | 'outline' | 'problems'>('explorer');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(['root', 'rtl', 'core'])
  );
  const [problemFilter, setProblemFilter] = useState<'all' | 'error' | 'warning'>('all');

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const outline = fileOutlines[currentOutlineId] || [];
  const filteredProblems = problemFilter === 'all'
    ? problemsList
    : problemsList.filter((p) => p.severity === problemFilter);
  const errorCount = problemsList.filter((p) => p.severity === 'error').length;
  const warnCount = problemsList.filter((p) => p.severity === 'warning').length;

  return (
    <div className="flex flex-col h-full bg-[#252526] overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-[#3d3d3d]">
        {(['explorer', 'outline', 'problems'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs transition-colors border-b-2 ${
              tab === t
                ? 'text-white border-[#0e639c]'
                : 'text-[#858585] border-transparent hover:text-[#cccccc]'
            }`}
            style={{ fontSize: '11px', fontWeight: tab === t ? 600 : 400 }}
          >
            {t === 'explorer' ? 'Explorer' : t === 'outline' ? 'Outline' : (
              <span className="flex items-center gap-1">
                Problems
                {errorCount > 0 && (
                  <span className="bg-[#f48771] text-white rounded-full px-1" style={{ fontSize: '10px' }}>
                    {errorCount}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Explorer ── */}
      {tab === 'explorer' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="flex items-center px-3 py-1.5 shrink-0">
            <span className="flex-1 text-[#bbbbbb] uppercase" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em' }}>
              MY_SOC_PROJECT
            </span>
            <div className="flex items-center gap-1">
              <button title="New File" className="p-0.5 text-[#858585] hover:text-white transition-colors"><FilePlus size={14} /></button>
              <button title="New Folder" className="p-0.5 text-[#858585] hover:text-white transition-colors"><FolderPlus size={14} /></button>
              <button title="Refresh" className="p-0.5 text-[#858585] hover:text-white transition-colors"><RefreshCw size={13} /></button>
              <button title="Collapse All" className="p-0.5 text-[#858585] hover:text-white transition-colors"><ChevronsUpDown size={13} /></button>
            </div>
          </div>
          {/* Tree */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {initialFileTree.map((node) => (
              <FileTreeNode
                key={node.id}
                node={node}
                depth={0}
                activeFileId={activeFileId}
                onFileOpen={onFileOpen}
                expandedFolders={expandedFolders}
                onToggleFolder={toggleFolder}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Outline ── */}
      {tab === 'outline' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-1.5 shrink-0">
            <span className="text-[#bbbbbb] uppercase" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em' }}>
              OUTLINE — {currentOutlineId || 'No file open'}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {outline.length === 0 ? (
              <div className="px-4 py-3 text-[#858585]" style={{ fontSize: '12px' }}>
                No outline information available
              </div>
            ) : (
              outline.map((item) => (
                <OutlineNode key={item.id} item={item} depth={0} onLineJump={onLineJump} />
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Problems ── */}
      {tab === 'problems' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 shrink-0 border-b border-[#3d3d3d]">
            <span className="text-[#bbbbbb] uppercase flex-1" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em' }}>
              PROBLEMS ({problemsList.length})
            </span>
            {(['all', 'error', 'warning'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setProblemFilter(f)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  problemFilter === f ? 'bg-[#094771] text-white' : 'text-[#858585] hover:text-[#cccccc]'
                }`}
                style={{ fontSize: '10px' }}
              >
                {f === 'all' ? `All ${problemsList.length}` : f === 'error' ? `Errors ${errorCount}` : `Warnings ${warnCount}`}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredProblems.map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-2 px-3 py-1.5 hover:bg-[#2a2d2e] cursor-pointer border-b border-[#2d2d2d] transition-colors"
                onClick={() => { onFileOpen(p.fileId, p.file); onLineJump(p.line); }}
              >
                <span className="mt-0.5 shrink-0"><SeverityIcon severity={p.severity} /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-[#cccccc] truncate" style={{ fontSize: '12px' }}>{p.message}</div>
                  <div className="text-[#858585] flex gap-2" style={{ fontSize: '11px' }}>
                    <span>{p.file}</span>
                    <span>L{p.line}:{p.column}</span>
                    {p.code && <span className="text-[#555]">[{p.source}:{p.code}]</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}