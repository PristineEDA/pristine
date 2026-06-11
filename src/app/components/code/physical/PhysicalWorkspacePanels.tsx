import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ClipboardList,
  FileText,
  Gauge,
  Layers3,
  PanelBottomClose,
  PanelBottomOpen,
  Ruler,
  ScanSearch,
  X,
  Maximize,
  Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { useCodeViewerLayout } from '../../../context/CodeViewerLayoutContext';
import { Button } from '../../ui/button';
import { TooltipIconButton } from '../../ui/tooltip-icon-button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../../ui/resizable';
import { SPLIT_PANEL_CONTENT_TRANSITION_STYLE, useAnimatedSplitPanelPresence } from '../explorer/useAnimatedSplitPanelPresence';
import {
  compactIconTabToggleIconSize,
  compactIconTabToggleItemClassName,
  IconTabToggleGroup,
  type IconTabToggleGroupItem,
} from '../shared/IconTabToggleGroup';
import {
  getBottomPanelClassName,
  getBottomPanelTabBarClassName,
  getCodeWorkspacePanelFrameClassName,
  getCodeWorkspacePanelGroupLayoutGapPx,
  getCodeWorkspaceResizeHandleClassName,
  getEditorAreaRootClassName,
  getPanelHeaderClassName,
} from '../shared/codeViewerLayoutStyles';

type PhysicalLeftPanelTab = 'layout' | 'constraints';
type PhysicalRightPanelTab = 'inspector' | 'checks';
type PhysicalBottomPanelTab = 'reports' | 'console';

const physicalLeftPanelTabs = [
  { value: 'layout', label: 'Layout', icon: Layers3, testId: 'physical-left-panel-tab-layout' },
  { value: 'constraints', label: 'Constraints', icon: Ruler, testId: 'physical-left-panel-tab-constraints' },
] as const satisfies readonly IconTabToggleGroupItem[];

const physicalRightPanelTabs = [
  { value: 'inspector', label: 'Inspector', icon: ScanSearch, testId: 'physical-right-panel-tab-inspector' },
  { value: 'checks', label: 'Checks', icon: Gauge, testId: 'physical-right-panel-tab-checks' },
] as const satisfies readonly IconTabToggleGroupItem[];

const physicalBottomPanelTabs = [
  { value: 'reports', label: 'Reports', icon: ClipboardList, testId: 'physical-bottom-panel-tab-reports' },
  { value: 'console', label: 'Console', icon: FileText, testId: 'physical-bottom-panel-tab-console' },
] as const satisfies readonly IconTabToggleGroupItem[];

function PhysicalEmptyState({ title, description, testId }: { title: string; description: string; testId: string }) {
  return (
    <div data-testid={testId} className="flex h-full min-h-0 flex-col items-center justify-center px-4 text-center">
      <p className="text-[12px] font-medium text-ide-text">{title}</p>
      <p className="mt-1 max-w-[220px] text-[11px] leading-5 text-ide-text-muted">{description}</p>
    </div>
  );
}

function PhysicalPanelTabs<TTab extends string>({
  activeTab,
  groupLabel,
  groupTestId,
  isSplitPanelVisible,
  items,
  onTabChange,
  onToggleSplitPanel,
  splitToggleTestId,
  splitToggleAriaLabel,
}: {
  activeTab: TTab;
  groupLabel: string;
  groupTestId: string;
  isSplitPanelVisible?: boolean;
  items: readonly IconTabToggleGroupItem[];
  onTabChange: (tab: TTab) => void;
  onToggleSplitPanel?: () => void;
  splitToggleTestId?: string;
  splitToggleAriaLabel?: {
    hide: string;
    show: string;
  };
}) {
  const { layoutMode } = useCodeViewerLayout();
  const SplitPanelIcon = isSplitPanelVisible ? PanelBottomClose : PanelBottomOpen;

  return (
    <div data-code-viewer-layout-mode={layoutMode} className={getPanelHeaderClassName(layoutMode)}>
      <IconTabToggleGroup
        items={items}
        value={activeTab}
        onValueChange={(nextValue) => onTabChange(nextValue as TTab)}
        groupLabel={groupLabel}
        groupTestId={groupTestId}
        tooltipSide="bottom"
        itemClassName={compactIconTabToggleItemClassName}
        iconSize={compactIconTabToggleIconSize}
      />

      {onToggleSplitPanel && splitToggleTestId && splitToggleAriaLabel && (
        <div className="ml-auto flex items-center gap-1">
          <TooltipIconButton content={isSplitPanelVisible ? 'Hide Lower Panel' : 'Show Lower Panel'} side="bottom">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={isSplitPanelVisible ? splitToggleAriaLabel.hide : splitToggleAriaLabel.show}
              aria-pressed={Boolean(isSplitPanelVisible)}
              data-testid={splitToggleTestId}
              className="text-ide-text-muted hover:text-ide-text"
              onClick={onToggleSplitPanel}
            >
              <SplitPanelIcon size={13} />
            </Button>
          </TooltipIconButton>
        </div>
      )}
    </div>
  );
}

export function PhysicalMainPanel() {
  const { layoutMode } = useCodeViewerLayout();

  return (
    <div className={getEditorAreaRootClassName(layoutMode)}>
      <PhysicalEmptyState
        testId="physical-main-panel-content"
        title="Physical"
        description="Coming soon"
      />
    </div>
  );
}

function PhysicalLowerPanel({
  description,
  isExpanded,
  testId,
  title,
}: {
  description: string;
  isExpanded: boolean;
  testId: string;
  title: string;
}) {
  const { layoutMode } = useCodeViewerLayout();
  const splitPanelFrameClassName = getCodeWorkspacePanelFrameClassName(layoutMode, 'flex h-full flex-col bg-ide-bg text-ide-text');

  return (
    <section
      data-testid={testId}
      className={splitPanelFrameClassName}
      style={{
        ...SPLIT_PANEL_CONTENT_TRANSITION_STYLE,
        opacity: isExpanded ? 1 : 0,
      }}
    >
      <PhysicalEmptyState
        testId={`${testId}-content`}
        title={title}
        description={description}
      />
    </section>
  );
}

export function PhysicalLeftPanel({
  onSplitPanelVisibleChange,
}: {
  onSplitPanelVisibleChange?: (isVisible: boolean) => void;
}) {
  const { layoutMode } = useCodeViewerLayout();
  const [tab, setTab] = useState<PhysicalLeftPanelTab>('layout');
  const [isSplitPanelVisible, setIsSplitPanelVisible] = useState(false);
  const splitPanelPresence = useAnimatedSplitPanelPresence(isSplitPanelVisible);
  const splitPanelFrameClassName = getCodeWorkspacePanelFrameClassName(layoutMode, 'flex h-full flex-col bg-ide-bg text-ide-text');

  useEffect(() => {
    onSplitPanelVisibleChange?.(splitPanelPresence.shouldRender);
  }, [onSplitPanelVisibleChange, splitPanelPresence.shouldRender]);

  const header = (
    <PhysicalPanelTabs
      activeTab={tab}
      groupLabel="Physical left panel tabs"
      groupTestId="physical-left-panel-tabs"
      isSplitPanelVisible={isSplitPanelVisible}
      items={physicalLeftPanelTabs}
      onTabChange={setTab}
      onToggleSplitPanel={() => setIsSplitPanelVisible((current) => !current)}
      splitToggleTestId="physical-left-panel-split-toggle"
      splitToggleAriaLabel={{
        hide: 'Hide lower physical left panel',
        show: 'Show lower physical left panel',
      }}
    />
  );

  const primaryContent = (
    <div className="min-h-0 flex-1 overflow-hidden">
      {tab === 'layout' ? (
        <PhysicalEmptyState
          testId="physical-left-panel-layout-content"
          title="Layout"
          description="Physical hierarchy and floorplan layers will appear here."
        />
      ) : (
        <PhysicalEmptyState
          testId="physical-left-panel-constraints-content"
          title="Constraints"
          description="Constraint groups and physical rule sets will appear here."
        />
      )}
    </div>
  );

  return (
    <div
      data-testid="physical-left-panel-root"
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden text-ide-text',
        !(layoutMode === 'minimal' && splitPanelPresence.shouldRender) && 'bg-ide-bg',
      )}
    >
      {!splitPanelPresence.shouldRender && (
        <>
          {header}

          <div data-testid="physical-left-panel-primary-panel" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {primaryContent}
          </div>
        </>
      )}

      {splitPanelPresence.shouldRender && (
        <ResizablePanelGroup
          data-testid="physical-left-panel-split-group"
          className="flex-1"
          orientation="vertical"
          layoutGapPx={getCodeWorkspacePanelGroupLayoutGapPx(layoutMode)}
        >
          <ResizablePanel id="physical-left-panel-primary" defaultSize={50} minSize={25} minSizePx={120}>
            <section data-testid="physical-left-panel-primary-panel" className={splitPanelFrameClassName}>
              {header}
              {primaryContent}
            </section>
          </ResizablePanel>

          <ResizableHandle
            data-testid="physical-left-panel-split-resize-handle"
            hidden={!splitPanelPresence.isExpanded}
            className={getCodeWorkspaceResizeHandleClassName(layoutMode)}
          />

          <ResizablePanel
            id="physical-left-panel-lower"
            defaultSize={50}
            minSize={25}
            minSizePx={120}
            collapsed={!splitPanelPresence.isExpanded}
          >
            <PhysicalLowerPanel
              testId="physical-left-panel-lower-panel"
              title="Layer Details"
              description="Floorplan layer details and visibility controls will appear here."
              isExpanded={splitPanelPresence.isExpanded}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}

export function PhysicalRightPanel({
  onSplitPanelVisibleChange,
}: {
  onSplitPanelVisibleChange?: (isVisible: boolean) => void;
}) {
  const { layoutMode } = useCodeViewerLayout();
  const [tab, setTab] = useState<PhysicalRightPanelTab>('inspector');
  const [isSplitPanelVisible, setIsSplitPanelVisible] = useState(false);
  const splitPanelPresence = useAnimatedSplitPanelPresence(isSplitPanelVisible);
  const splitPanelFrameClassName = getCodeWorkspacePanelFrameClassName(layoutMode, 'flex h-full flex-col bg-ide-bg text-ide-text');

  useEffect(() => {
    onSplitPanelVisibleChange?.(splitPanelPresence.shouldRender);
  }, [onSplitPanelVisibleChange, splitPanelPresence.shouldRender]);

  const header = (
    <PhysicalPanelTabs
      activeTab={tab}
      groupLabel="Physical right panel tabs"
      groupTestId="physical-right-panel-tabs"
      isSplitPanelVisible={isSplitPanelVisible}
      items={physicalRightPanelTabs}
      onTabChange={setTab}
      onToggleSplitPanel={() => setIsSplitPanelVisible((current) => !current)}
      splitToggleTestId="physical-right-panel-split-toggle"
      splitToggleAriaLabel={{
        hide: 'Hide lower physical right panel',
        show: 'Show lower physical right panel',
      }}
    />
  );

  const primaryContent = (
    <div className="min-h-0 flex-1 overflow-hidden">
      {tab === 'inspector' ? (
        <PhysicalEmptyState
          testId="physical-right-panel-inspector-content"
          title="Inspector"
          description="Selected physical objects and properties will appear here."
        />
      ) : (
        <PhysicalEmptyState
          testId="physical-right-panel-checks-content"
          title="Checks"
          description="Physical checks and signoff summaries will appear here."
        />
      )}
    </div>
  );

  return (
    <div
      data-testid="physical-right-panel-root"
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden text-ide-text',
        !(layoutMode === 'minimal' && splitPanelPresence.shouldRender) && 'bg-ide-bg',
      )}
    >
      {!splitPanelPresence.shouldRender && (
        <>
          {header}

          <div data-testid="physical-right-panel-primary-panel" className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {primaryContent}
          </div>
        </>
      )}

      {splitPanelPresence.shouldRender && (
        <ResizablePanelGroup
          data-testid="physical-right-panel-split-group"
          className="flex-1"
          orientation="vertical"
          layoutGapPx={getCodeWorkspacePanelGroupLayoutGapPx(layoutMode)}
        >
          <ResizablePanel id="physical-right-panel-primary" defaultSize={50} minSize={25} minSizePx={120}>
            <section data-testid="physical-right-panel-primary-panel" className={splitPanelFrameClassName}>
              {header}
              {primaryContent}
            </section>
          </ResizablePanel>

          <ResizableHandle
            data-testid="physical-right-panel-split-resize-handle"
            hidden={!splitPanelPresence.isExpanded}
            className={getCodeWorkspaceResizeHandleClassName(layoutMode)}
          />

          <ResizablePanel
            id="physical-right-panel-lower"
            defaultSize={50}
            minSize={25}
            minSizePx={120}
            collapsed={!splitPanelPresence.isExpanded}
          >
            <PhysicalLowerPanel
              testId="physical-right-panel-lower-panel"
              title="Selection Details"
              description="Selected instance details, rule results, and physical metadata will appear here."
              isExpanded={splitPanelPresence.isExpanded}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}

export function PhysicalBottomPanel({
  isMaximized = false,
  onClose,
  onMaximizeToggle,
}: {
  isMaximized?: boolean;
  onClose?: () => void;
  onMaximizeToggle?: () => void;
}) {
  const { layoutMode } = useCodeViewerLayout();
  const [tab, setTab] = useState<PhysicalBottomPanelTab>('reports');
  const MaximizeIcon = isMaximized ? Minimize2 : Maximize;
  const maximizeLabel = isMaximized ? 'Restore Panel' : 'Maximize Panel';
  const panelContent = useMemo<Record<PhysicalBottomPanelTab, ReactNode>>(() => ({
    reports: (
      <PhysicalEmptyState
        testId="physical-bottom-panel-reports-content"
        title="Reports"
        description="Area, congestion, timing, and route reports will appear here."
      />
    ),
    console: (
      <PhysicalEmptyState
        testId="physical-bottom-panel-console-content"
        title="Console"
        description="Physical command output and run logs will appear here."
      />
    ),
  }), []);

  return (
    <div data-testid="physical-bottom-panel-root" data-code-viewer-layout-mode={layoutMode} className={getBottomPanelClassName(layoutMode)}>
      <div data-testid="physical-bottom-panel-tab-bar" className={getBottomPanelTabBarClassName(layoutMode)}>
        <IconTabToggleGroup
          items={physicalBottomPanelTabs}
          value={tab}
          onValueChange={(nextValue) => setTab(nextValue as PhysicalBottomPanelTab)}
          groupLabel="Physical bottom panel tabs"
          groupTestId="physical-bottom-panel-tabs"
          tooltipSide="top"
          className="shrink-0"
          itemClassName={compactIconTabToggleItemClassName}
          iconSize={compactIconTabToggleIconSize}
        />

        <div className="ml-auto flex items-center gap-1">
          {onMaximizeToggle && (
            <TooltipIconButton content={maximizeLabel}>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={maximizeLabel}
                data-testid="physical-bottom-panel-maximize"
                className="text-ide-text-muted hover:text-ide-text"
                onClick={onMaximizeToggle}
              >
                <MaximizeIcon size={13} />
              </Button>
            </TooltipIconButton>
          )}
          <TooltipIconButton content="Close Panel">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Close Physical Panel"
              data-testid="physical-bottom-panel-close"
              className="text-ide-text-muted hover:text-ide-text"
              onClick={onClose}
            >
              <X size={13} />
            </Button>
          </TooltipIconButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {panelContent[tab]}
      </div>
    </div>
  );
}
