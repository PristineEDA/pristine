import {
  FolderCodeIcon,
  ListTree,
  PanelBottomClose,
  PanelBottomOpen,
} from 'lucide-react';
import { useCodeViewerLayout } from '../../../context/CodeViewerLayoutContext';
import { Button } from '../../ui/button';
import { TooltipIconButton } from '../../ui/tooltip-icon-button';
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
  isSplitPanelVisible,
  onTabChange,
  onToggleSplitPanel,
}: {
  activeTab: ExplorerPanelTab;
  isSplitPanelVisible: boolean;
  onTabChange: (tab: ExplorerPanelTab) => void;
  onToggleSplitPanel: () => void;
}) {
  const { layoutMode } = useCodeViewerLayout();
  const SplitPanelIcon = isSplitPanelVisible ? PanelBottomClose : PanelBottomOpen;

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

      <div className="ml-auto flex items-center gap-1">
        <TooltipIconButton content={isSplitPanelVisible ? 'Hide Lower Panel' : 'Show Lower Panel'} side="bottom">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={isSplitPanelVisible ? 'Hide lower explorer panel' : 'Show lower explorer panel'}
            aria-pressed={isSplitPanelVisible}
            data-testid="left-panel-split-toggle"
            className="text-ide-text-muted hover:text-ide-text"
            onClick={onToggleSplitPanel}
          >
            <SplitPanelIcon size={13} />
          </Button>
        </TooltipIconButton>
      </div>
    </div>
  );
}
