import {
  FolderCodeIcon,
  ListTree,
} from 'lucide-react';
import { useCodeViewerLayout } from '../../../context/CodeViewerLayoutContext';
import {
  compactIconTabToggleIconSize,
  compactIconTabToggleItemClassName,
  IconTabToggleGroup,
} from '../shared/IconTabToggleGroup';
import { getPanelHeaderClassName } from '../shared/codeViewerLayoutStyles';

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
  const { layoutMode } = useCodeViewerLayout();

  return (
    <div
      data-testid="left-panel-header"
      data-code-viewer-layout-mode={layoutMode}
      className={getPanelHeaderClassName(layoutMode)}
    >
      <IconTabToggleGroup
        items={explorerPanelTabs}
        value={activeTab}
        onValueChange={(tab) => onTabChange(tab as ExplorerPanelTab)}
        groupLabel="Left panel tabs"
        groupTestId="left-panel-tabs"
        tooltipSide="bottom"
        itemClassName={compactIconTabToggleItemClassName}
        iconSize={compactIconTabToggleIconSize}
      />
    </div>
  );
}
