import { useState, useMemo } from 'react';
import {
  FilePlus, FolderPlus, RefreshCw, ChevronsUpDown,
  AlertCircle, AlertTriangle, Info, Circle,
} from 'lucide-react';
import { useFileOutlines, useProblemsList } from '../../data/mockDataLoader';
import { FileTreeNode } from './FileTreeNode';
import { OutlineNode } from './OutlineNode';
import { DEFAULT_STARTUP_PROJECT_NAME } from '../workspace/workspaceFiles';
import { useWorkspaceTree, type WorkspaceRevealRequest } from '../workspace/useWorkspaceTree';
import type { Problem } from '../../data/mockData';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';

interface LeftSidePanelProps {
  activeFileId: string;
  onFileOpen: (fileId: string, fileName: string) => void;
  onFilePreview: (fileId: string, fileName: string) => void;
  onLineJump: (line: number) => void;
  currentOutlineId: string;
  revealRequest?: WorkspaceRevealRequest | null;
  onWorkspaceRefresh?: () => void;
}

function SeverityIcon({ severity }: { severity: Problem['severity'] }) {
  if (severity === 'error') return <AlertCircle size={13} className="text-destructive shrink-0" />;
  if (severity === 'warning') return <AlertTriangle size={13} className="text-amber-500 shrink-0" />;
  if (severity === 'info') return <Info size={13} className="text-blue-500 shrink-0" />;
  return <Circle size={10} className="text-muted-foreground shrink-0" />;
}

export function LeftSidePanel({
  activeFileId,
  onFileOpen,
  onFilePreview,
  onLineJump,
  currentOutlineId,
  revealRequest,
  onWorkspaceRefresh,
}: LeftSidePanelProps) {
  const [tab, setTab] = useState<'explorer' | 'outline' | 'problems'>('explorer');
  const [problemFilter, setProblemFilter] = useState<'all' | 'error' | 'warning'>('all');
  const problemsList = useProblemsList();
  const fileOutlines = useFileOutlines();
  const {
    treeNodes,
    workspaceAvailable,
    expandedFolders,
    toggleFolder,
    refreshTree,
    collapseAll,
  } = useWorkspaceTree(revealRequest);

  const outline = fileOutlines[currentOutlineId] || [];
  const filteredProblems = useMemo(() =>
    problemFilter === 'all'
      ? problemsList
      : problemsList.filter((p) => p.severity === problemFilter),
    [problemFilter, problemsList]
  );
  const errorCount = useMemo(() => problemsList.filter((p) => p.severity === 'error').length, [problemsList]);
  const warnCount = useMemo(() => problemsList.filter((p) => p.severity === 'warning').length, [problemsList]);

  return (
    <div className="flex flex-col h-full bg-muted/40 overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-border">
        {(['explorer', 'outline', 'problems'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 transition-colors border-b-2 ${
              tab === t
                ? 'text-[11px] font-semibold text-foreground border-primary'
                : 'text-[11px] text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            {t === 'explorer' ? 'Explorer' : t === 'outline' ? 'Outline' : (
              <span className="flex items-center gap-1">
                Problems
                {errorCount > 0 && (
                  <Badge variant="destructive" className="h-4 px-1 text-[10px]">{errorCount}</Badge>
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
            <span className="flex-1 text-muted-foreground uppercase text-[11px] font-bold tracking-wide">
              {DEFAULT_STARTUP_PROJECT_NAME}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" title="New File" className="text-muted-foreground hover:text-foreground"><FilePlus size={14} /></Button>
              <Button variant="ghost" size="icon" title="New Folder" className="text-muted-foreground hover:text-foreground"><FolderPlus size={14} /></Button>
              <Button
                variant="ghost"
                size="icon"
                title="Refresh"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                  onWorkspaceRefresh?.();
                  refreshTree();
                }}
              ><RefreshCw size={13} /></Button>
              <Button variant="ghost" size="icon" title="Collapse All" className="text-muted-foreground hover:text-foreground" onClick={collapseAll}><ChevronsUpDown size={13} /></Button>
            </div>
          </div>
          <div className="explorer-tree-scrollbar flex-1 overflow-y-auto overflow-x-hidden">
            {workspaceAvailable === null && (
              <div className="px-4 py-3 text-muted-foreground text-[12px]">Loading workspace...</div>
            )}
            {workspaceAvailable === false && (
              <div className="px-4 py-3 text-muted-foreground text-[12px]">No workspace files available</div>
            )}
            {workspaceAvailable && treeNodes.map((node) => (
              <FileTreeNode
                key={node.id}
                node={node}
                depth={0}
                activeFileId={activeFileId}
                onFileOpen={onFileOpen}
                onFilePreview={onFilePreview}
                expandedFolders={expandedFolders}
                onToggleFolder={toggleFolder}
                revealRequest={revealRequest}
              />
            ))}
          </div>
        </div>
      )}

      {/* Outline */}
      {tab === 'outline' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-1.5 shrink-0">
            <span className="text-muted-foreground uppercase text-[11px] font-bold tracking-wide">
              OUTLINE — {currentOutlineId || 'No file open'}
            </span>
          </div>
          <ScrollArea className="flex-1">
            {outline.length === 0 ? (
              <div className="px-4 py-3 text-muted-foreground text-[12px]">
                No outline information available
              </div>
            ) : (
              outline.map((item) => (
                <OutlineNode key={item.id} item={item} depth={0} onLineJump={onLineJump} />
              ))
            )}
          </ScrollArea>
        </div>
      )}

      {/* Problems */}
      {tab === 'problems' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 shrink-0 border-b border-border">
            <span className="text-muted-foreground uppercase flex-1 text-[11px] font-bold tracking-wide">
              PROBLEMS ({problemsList.length})
            </span>
            {(['all', 'error', 'warning'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setProblemFilter(f)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  problemFilter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                } text-[10px]`}
              >
                {f === 'all' ? `All ${problemsList.length}` : f === 'error' ? `Errors ${errorCount}` : `Warnings ${warnCount}`}
              </button>
            ))}
          </div>
          <ScrollArea className="flex-1">
            {filteredProblems.map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-2 px-3 py-1.5 hover:bg-accent cursor-pointer border-b border-muted transition-colors"
                onClick={() => { onFileOpen(p.fileId, p.file); onLineJump(p.line); }}
              >
                <span className="mt-0.5 shrink-0"><SeverityIcon severity={p.severity} /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-foreground truncate text-[12px]">{p.message}</div>
                  <div className="text-muted-foreground flex gap-2 text-[11px]">
                    <span>{p.file}</span>
                    <span>L{p.line}:{p.column}</span>
                    {p.code && <span className="text-muted-foreground/70">[{p.source}:{p.code}]</span>}
                  </div>
                </div>
              </div>
            ))}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
