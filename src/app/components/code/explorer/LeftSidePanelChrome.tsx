import {
  ChevronsUpDown,
  FilePlus,
  FolderPlus,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { TooltipIconButton } from '../../ui/tooltip-icon-button';

export type ExplorerPanelTab = 'explorer' | 'outline';

export function ExplorerPanelTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: ExplorerPanelTab;
  onTabChange: (tab: ExplorerPanelTab) => void;
}) {
  return (
    <div className="flex shrink-0 border-b border-border">
      {(['explorer', 'outline'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`px-3 py-2 transition-colors border-b-2 ${
            activeTab === tab
              ? 'text-[11px] font-semibold text-foreground border-primary'
              : 'text-[11px] text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          {tab === 'explorer' ? 'Explorer' : 'Outline'}
        </button>
      ))}
    </div>
  );
}

export function ExplorerToolbar({
  onCollapseAll,
  onCreateFile,
  onCreateFolder,
  onRefresh,
  projectName,
}: {
  onCollapseAll: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onRefresh: () => void;
  projectName: string;
}) {
  return (
    <div className="flex items-center px-3 shrink-0">
      <span className="flex-1 text-muted-foreground uppercase text-[11px] font-bold tracking-wide">
        {projectName}
      </span>
      <div className="flex items-center">
        <TooltipIconButton content="New File">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New File"
            className="text-muted-foreground hover:text-foreground"
            onClick={onCreateFile}
          >
            <FilePlus size={14} />
          </Button>
        </TooltipIconButton>
        <TooltipIconButton content="New Folder">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New Folder"
            className="text-muted-foreground hover:text-foreground"
            onClick={onCreateFolder}
          >
            <FolderPlus size={14} />
          </Button>
        </TooltipIconButton>
        <TooltipIconButton content="Refresh">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Refresh"
            className="text-muted-foreground hover:text-foreground"
            onClick={onRefresh}
          >
            <RefreshCw size={13} />
          </Button>
        </TooltipIconButton>
        <TooltipIconButton content="Collapse All">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Collapse All"
            className="text-muted-foreground hover:text-foreground"
            onClick={onCollapseAll}
          >
            <ChevronsUpDown size={13} />
          </Button>
        </TooltipIconButton>
      </div>
    </div>
  );
}
