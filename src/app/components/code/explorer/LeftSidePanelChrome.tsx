import {
  FolderCodeIcon,
  ListTree,
} from 'lucide-react';
import { IconTabToggleGroup } from '../shared/IconTabToggleGroup';

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
  projectName,
}: {
  projectName: string;
}) {
  return (
    <div className="flex items-center px-3 py-1.5 shrink-0">
      <span className="flex-1 text-muted-foreground uppercase text-[11px] font-bold tracking-wide">
        {projectName}
      </span>
    </div>
  );
}
