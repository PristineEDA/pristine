import { useState } from 'react';
import {
  FilePlus, FolderPlus, RefreshCw, ChevronsUpDown,
} from 'lucide-react';
import { useFileOutlines } from '../../../../data/mockDataLoader';
import { FileTreeNode } from './FileTreeNode';
import { OutlineNode } from './OutlineNode';
import { DEFAULT_STARTUP_PROJECT_NAME } from '../../../workspace/workspaceFiles';
import { useWorkspaceTree, type WorkspaceRevealRequest } from '../../../workspace/useWorkspaceTree';
import { Button } from '../../ui/button';
import { ScrollArea } from '../../ui/scroll-area';
import { TooltipIconButton } from '../../ui/tooltip-icon-button';

interface LeftSidePanelProps {
  activeFileId: string;
  onFileOpen: (fileId: string, fileName: string) => void;
  onFilePreview: (fileId: string, fileName: string) => void;
  onLineJump: (line: number) => void;
  currentOutlineId: string;
  revealRequest?: WorkspaceRevealRequest | null;
  onWorkspaceRefresh?: () => void;
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
  const [tab, setTab] = useState<'explorer' | 'outline'>('explorer');
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

  return (
    <div className="flex flex-col h-full bg-muted/40 overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-border">
        {(['explorer', 'outline'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 transition-colors border-b-2 ${
              tab === t
                ? 'text-[11px] font-semibold text-foreground border-primary'
                : 'text-[11px] text-muted-foreground border-transparent hover:text-foreground'
            }`}
          >
            {t === 'explorer' ? 'Explorer' : 'Outline'}
          </button>
        ))}
      </div>

      {/* Explorer */}
      {tab === 'explorer' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex items-center px-3 shrink-0">
            <span className="flex-1 text-muted-foreground uppercase text-[11px] font-bold tracking-wide">
              {DEFAULT_STARTUP_PROJECT_NAME}
            </span>
            <div className="flex items-center">
              <TooltipIconButton content="New File">
                <Button variant="ghost" size="icon-sm" aria-label="New File" className="text-muted-foreground hover:text-foreground"><FilePlus size={14} /></Button>
              </TooltipIconButton>
              <TooltipIconButton content="New Folder">
                <Button variant="ghost" size="icon-sm" aria-label="New Folder" className="text-muted-foreground hover:text-foreground"><FolderPlus size={14} /></Button>
              </TooltipIconButton>
              <TooltipIconButton content="Refresh">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Refresh"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    onWorkspaceRefresh?.();
                    refreshTree();
                  }}
                ><RefreshCw size={13} /></Button>
              </TooltipIconButton>
              <TooltipIconButton content="Collapse All">
                <Button variant="ghost" size="icon-sm" aria-label="Collapse All" className="text-muted-foreground hover:text-foreground" onClick={collapseAll}><ChevronsUpDown size={13} /></Button>
              </TooltipIconButton>
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
    </div>
  );
}
