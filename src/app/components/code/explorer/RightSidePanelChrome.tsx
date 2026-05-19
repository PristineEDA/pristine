import {
  BetweenHorizontalStart,
  ListTree,
  PanelBottomClose,
  PanelBottomOpen,
  ShieldCheck,
  Sparkles,
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

export type RightSidePanelTab = 'ai' | 'static' | 'references' | 'outline';

const rightPanelTabs = [
  { value: 'ai', label: 'AI Assistant', icon: Sparkles, testId: 'right-panel-tab-ai' },
  { value: 'static', label: 'Static Check', icon: ShieldCheck, testId: 'right-panel-tab-static' },
  { value: 'references', label: 'References', icon: BetweenHorizontalStart, testId: 'right-panel-tab-references' },
  { value: 'outline', label: 'Outline', icon: ListTree, testId: 'right-panel-tab-outline' },
] as const;

export function RightPanelTabs({
  activeTab,
  isSplitPanelVisible,
  onTabChange,
  onToggleSplitPanel,
}: {
  activeTab: RightSidePanelTab;
  isSplitPanelVisible: boolean;
  onTabChange: (tab: RightSidePanelTab) => void;
  onToggleSplitPanel: () => void;
}) {
  const { layoutMode } = useCodeViewerLayout();
  const SplitPanelIcon = isSplitPanelVisible ? PanelBottomClose : PanelBottomOpen;

  return (
    <div
      data-testid="right-panel-header"
      data-code-viewer-layout-mode={layoutMode}
      className={getPanelHeaderClassName(layoutMode)}
    >
      <IconTabToggleGroup
        items={rightPanelTabs}
        value={activeTab}
        onValueChange={(nextValue) => onTabChange(nextValue as RightSidePanelTab)}
        groupLabel="Right panel tabs"
        groupTestId="right-panel-tabs"
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
            aria-label={isSplitPanelVisible ? 'Hide lower right panel' : 'Show lower right panel'}
            aria-pressed={isSplitPanelVisible}
            data-testid="right-panel-split-toggle"
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