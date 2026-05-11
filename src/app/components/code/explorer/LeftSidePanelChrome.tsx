import {
  ChevronsUpDown,
  FilePlus,
  FolderCodeIcon,
  FolderPlus,
  ListTree,
  RefreshCw,
} from 'lucide-react';
import { IconTabToggleGroup } from '../shared/IconTabToggleGroup';
import { Button } from '../../ui/button';
import { TooltipIconButton } from '../../ui/tooltip-icon-button';

export type ExplorerPanelTab = 'explorer' | 'outline';

const explorerPanelTabs = [
  { value: 'explorer', label: 'Explorer', icon: FolderCodeIcon, testId: 'left-panel-tab-explorer' },
  { value: 'outline', label: 'Outline', icon: ListTree, testId: 'left-panel-tab-outline' },
] as const;

export function ExplorerPanelTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: ExplorerPanelTab;
  onTabChange: (tab: ExplorerPanelTab) => void;
}) {
  return (
    <div className="flex shrink-0 items-center border-b border-border px-2 py-1.5">
      <IconTabToggleGroup
        items={explorerPanelTabs}
        value={activeTab}
        onValueChange={(tab) => onTabChange(tab as ExplorerPanelTab)}
        groupLabel="Left panel tabs"
        groupTestId="left-panel-tabs"
        tooltipSide="bottom"
      />
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
