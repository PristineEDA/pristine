import { useState, useMemo } from 'react';
import {
  FilePlus, FolderPlus, RefreshCw, ChevronsUpDown,
  AlertCircle, AlertTriangle, Info, Circle,
} from 'lucide-react';
import { Problem, problemsList, fileOutlines } from '../../data/mockData';
import { FileTreeNode } from './FileTreeNode';
import { OutlineNode } from './OutlineNode';
import { DEFAULT_STARTUP_PROJECT_NAME } from '../workspace/workspaceFiles';
import { useWorkspaceTree } from '../workspace/useWorkspaceTree';

interface LeftSidePanelProps {
  activeFileId: string;
  onFileOpen: (fileId: string, fileName: string) => void;
  onLineJump: (line: number) => void;
  currentOutlineId: string;
}

function SeverityIcon({ severity }: { severity: Problem['severity'] }) {
  if (severity === 'error') return <AlertCircle size={13} className="text-ide-error shrink-0" />;
  if (severity === 'warning') return <AlertTriangle size={13} className="text-ide-warning shrink-0" />;
  if (severity === 'info') return <Info size={13} className="text-ide-info-bright shrink-0" />;
  return <Circle size={10} className="text-ide-text-muted shrink-0" />;
}

export function LeftSidePanel({ activeFileId, onFileOpen, onLineJump, currentOutlineId }: LeftSidePanelProps) {
  const [tab, setTab] = useState<'explorer' | 'outline' | 'problems'>('explorer');
  const [problemFilter, setProblemFilter] = useState<'all' | 'error' | 'warning'>('all');
  const {
    treeNodes,
    workspaceAvailable,
    expandedFolders,
    toggleFolder,
    refreshTree,
    collapseAll,
  } = useWorkspaceTree();

  const outline = fileOutlines[currentOutlineId] || [];
  const filteredProblems = useMemo(() =>
    problemFilter === 'all'
      ? problemsList
      : problemsList.filter((p) => p.severity === problemFilter),
    [problemFilter]
  );
  const errorCount = useMemo(() => problemsList.filter((p) => p.severity === 'error').length, []);
  const warnCount = useMemo(() => problemsList.filter((p) => p.severity === 'warning').length, []);

  return (
    <div className="flex flex-col h-full bg-ide-sidebar-bg overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-ide-border">
        {(['explorer', 'outline', 'problems'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs transition-colors border-b-2 ${
              tab === t
                ? 'text-white border-ide-accent'
                : 'text-ide-text-muted border-transparent hover:text-ide-text'
            }`}
            style={{ fontSize: '11px', fontWeight: tab === t ? 600 : 400 }}
          >
            {t === 'explorer' ? 'Explorer' : t === 'outline' ? 'Outline' : (
              <span className="flex items-center gap-1">
                Problems
                {errorCount > 0 && (
                  <span className="bg-ide-error text-white rounded-full px-1 text-[10px]">
                    {errorCount}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Explorer */}
      {tab === 'explorer' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center px-3 py-1.5 shrink-0">
            <span className="flex-1 text-ide-text-section uppercase text-[11px] font-bold tracking-wide">
              {DEFAULT_STARTUP_PROJECT_NAME}
            </span>
            <div className="flex items-center gap-1">
              <button title="New File" className="p-0.5 text-ide-text-muted hover:text-white transition-colors"><FilePlus size={14} /></button>
              <button title="New Folder" className="p-0.5 text-ide-text-muted hover:text-white transition-colors"><FolderPlus size={14} /></button>
              <button title="Refresh" className="p-0.5 text-ide-text-muted hover:text-white transition-colors" onClick={refreshTree}><RefreshCw size={13} /></button>
              <button title="Collapse All" className="p-0.5 text-ide-text-muted hover:text-white transition-colors" onClick={collapseAll}><ChevronsUpDown size={13} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {workspaceAvailable === null && (
              <div className="px-4 py-3 text-ide-text-muted text-[12px]">Loading workspace...</div>
            )}
            {workspaceAvailable === false && (
              <div className="px-4 py-3 text-ide-text-muted text-[12px]">No workspace files available</div>
            )}
            {workspaceAvailable && treeNodes.map((node) => (
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

      {/* Outline */}
      {tab === 'outline' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-1.5 shrink-0">
            <span className="text-ide-text-section uppercase text-[11px] font-bold tracking-wide">
              OUTLINE — {currentOutlineId || 'No file open'}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {outline.length === 0 ? (
              <div className="px-4 py-3 text-ide-text-muted text-[12px]">
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

      {/* Problems */}
      {tab === 'problems' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 shrink-0 border-b border-ide-border">
            <span className="text-ide-text-section uppercase flex-1 text-[11px] font-bold tracking-wide">
              PROBLEMS ({problemsList.length})
            </span>
            {(['all', 'error', 'warning'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setProblemFilter(f)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  problemFilter === f ? 'bg-ide-accent-dark text-white' : 'text-ide-text-muted hover:text-ide-text'
                } text-[10px]`}
              >
                {f === 'all' ? `All ${problemsList.length}` : f === 'error' ? `Errors ${errorCount}` : `Warnings ${warnCount}`}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredProblems.map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-2 px-3 py-1.5 hover:bg-ide-hover cursor-pointer border-b border-ide-tab-bg transition-colors"
                onClick={() => { onFileOpen(p.fileId, p.file); onLineJump(p.line); }}
              >
                <span className="mt-0.5 shrink-0"><SeverityIcon severity={p.severity} /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-ide-text truncate text-[12px]">{p.message}</div>
                  <div className="text-ide-text-muted flex gap-2 text-[11px]">
                    <span>{p.file}</span>
                    <span>L{p.line}:{p.column}</span>
                    {p.code && <span className="text-ide-text-dim">[{p.source}:{p.code}]</span>}
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
