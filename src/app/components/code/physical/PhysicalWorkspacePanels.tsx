import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ClipboardList,
  FileText,
  Gauge,
  Layers3,
  ListChecks,
  PanelBottomClose,
  PanelBottomOpen,
  Ruler,
  ScanSearch,
  SlidersHorizontal,
  X,
  Maximize,
  Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LspLayoutCatalog, LspLayoutGeometry, LspLayoutOpenResult } from '../../../../../types/systemverilog-lsp';

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
import {
  PhysicalLayoutEditorPanel,
  type PhysicalLayoutStateSnapshot,
  type PhysicalLayoutStatus,
} from './PhysicalLayoutEditorPanel';
import {
  getPhysicalLayoutLayerColor,
  isLayoutLayerVisible,
  type VisibleLayoutLayerSet,
} from './physicalLayoutLayers';

type PhysicalLeftPanelTab = 'layout' | 'constraints';
type PhysicalLowerPanelTab = 'details' | 'notes';
type PhysicalRightPanelTab = 'layers' | 'checks';
type PhysicalBottomPanelTab = 'reports' | 'console';

const emptyVisibleLayoutLayerSet = new Set<number>();

export interface PhysicalWorkspaceLayoutState {
  catalog: LspLayoutCatalog | null;
  error: string | null;
  geometry: LspLayoutGeometry | null;
  openResult: LspLayoutOpenResult | null;
  status: PhysicalLayoutStatus;
}

const physicalLeftPanelTabs = [
  { value: 'layout', label: 'Layout', icon: Layers3, testId: 'physical-left-panel-tab-layout' },
  { value: 'constraints', label: 'Constraints', icon: Ruler, testId: 'physical-left-panel-tab-constraints' },
] as const satisfies readonly IconTabToggleGroupItem[];

const physicalRightPanelTabs = [
  { value: 'layers', label: 'Layers', icon: Layers3, testId: 'physical-right-panel-tab-layers' },
  { value: 'checks', label: 'Checks', icon: Gauge, testId: 'physical-right-panel-tab-checks' },
] as const satisfies readonly IconTabToggleGroupItem[];

const physicalLeftLowerPanelTabs = [
  { value: 'details', label: 'Details', icon: SlidersHorizontal, testId: 'physical-left-lower-panel-tab-details' },
  { value: 'notes', label: 'Notes', icon: ListChecks, testId: 'physical-left-lower-panel-tab-notes' },
] as const satisfies readonly IconTabToggleGroupItem[];

const physicalRightLowerPanelTabs = [
  { value: 'details', label: 'Inspector', icon: ScanSearch, testId: 'physical-right-lower-panel-tab-inspector' },
  { value: 'notes', label: 'Notes', icon: ListChecks, testId: 'physical-right-lower-panel-tab-notes' },
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

export function PhysicalMainPanel({
  onLayoutStateChange,
  onSelectedMacroNameChange,
  selectedMacroName,
  visibleLayerIndices,
}: {
  onLayoutStateChange?: (state: PhysicalLayoutStateSnapshot) => void;
  onSelectedMacroNameChange?: (macroName: string) => void;
  selectedMacroName?: string | null;
  visibleLayerIndices: VisibleLayoutLayerSet;
}) {
  const { layoutMode } = useCodeViewerLayout();

  return (
    <div className={getEditorAreaRootClassName(layoutMode)}>
      <div data-testid="physical-main-panel-content" className="h-full min-h-0">
        <PhysicalLayoutEditorPanel
          selectedMacroName={selectedMacroName ?? null}
          visibleLayerIndices={visibleLayerIndices}
          onLayoutStateChange={onLayoutStateChange}
          onSelectedMacroNameChange={onSelectedMacroNameChange}
        />
      </div>
    </div>
  );
}

function PhysicalMacroList({
  catalog,
  selectedMacroName,
  onMacroActivate,
}: {
  catalog?: LspLayoutCatalog | null;
  selectedMacroName?: string | null;
  onMacroActivate?: (macroName: string) => void;
}) {
  const macros = catalog?.macros ?? [];

  if (macros.length === 0) {
    return (
      <PhysicalEmptyState
        testId="physical-left-panel-layout-content"
        title="Layout"
        description="Open IHP stdcell LEF macros will appear here."
      />
    );
  }

  return (
    <div data-testid="physical-left-panel-layout-content" className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-ide-border/60 px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-medium text-ide-text">Layout Macros</span>
          <span className="text-ide-text-muted" data-testid="physical-layout-macro-count">{macros.length}</span>
        </div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-1 py-1"
        data-testid="physical-layout-macro-list"
      >
        {macros.map((macro) => {
          const selected = macro.name === selectedMacroName;
          return (
            <button
              key={macro.name}
              type="button"
              aria-selected={selected}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[11px] hover:bg-ide-hover',
                selected ? 'bg-ide-selection text-ide-text' : 'text-ide-text-muted',
              )}
              data-testid={`physical-layout-macro-item-${sanitizeMacroTestId(macro.name)}`}
              onClick={() => onMacroActivate?.(macro.name)}
              onDoubleClick={() => onMacroActivate?.(macro.name)}
              title={macro.name}
            >
              <span className="min-w-0 truncate">{macro.name}</span>
              <span className="shrink-0 text-[10px] text-ide-text-muted">{macro.pinCount} pins</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PhysicalInspectorSummary({
  layoutState,
  selectedMacroName,
}: {
  layoutState?: PhysicalWorkspaceLayoutState;
  selectedMacroName?: string | null;
}) {
  const macro = layoutState?.catalog?.macros.find((entry) => entry.name === selectedMacroName) ?? null;

  if (!macro) {
    return (
      <PhysicalEmptyState
        testId="physical-right-panel-inspector-content"
        title="Inspector"
        description="Select a layout macro to inspect geometry metadata."
      />
    );
  }

  return (
    <div data-testid="physical-right-panel-inspector-content" className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3 text-[11px]">
      <div>
        <p className="font-medium text-ide-text">{macro.name}</p>
        <p className="mt-1 text-ide-text-muted">{macro.className || 'Macro'}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ide-text-muted">
        <dt>Size</dt>
        <dd className="text-ide-text">{macro.sizeX.toFixed(3)} x {macro.sizeY.toFixed(3)}</dd>
        <dt>Origin</dt>
        <dd className="text-ide-text">{macro.originX.toFixed(3)}, {macro.originY.toFixed(3)}</dd>
        <dt>Pins</dt>
        <dd className="text-ide-text">{macro.pinCount}</dd>
        <dt>Layers</dt>
        <dd className="text-ide-text">{layoutState?.catalog?.layers.length ?? 0}</dd>
        <dt>Shapes</dt>
        <dd className="text-ide-text">{layoutState?.geometry?.shapes.length ?? 0}</dd>
      </dl>
    </div>
  );
}

function PhysicalLayerPanel({
  catalog,
  visibleLayerIndices,
  onLayerVisibilityToggle,
}: {
  catalog?: LspLayoutCatalog | null;
  visibleLayerIndices: VisibleLayoutLayerSet;
  onLayerVisibilityToggle?: (layerIndex: number) => void;
}) {
  const layers = catalog?.layers ?? [];

  if (layers.length === 0) {
    return (
      <PhysicalEmptyState
        testId="physical-right-panel-layers-content"
        title="Layers"
        description="Layout layers will appear after the IHP stdcell LEF opens."
      />
    );
  }

  return (
    <div data-testid="physical-right-panel-layers-content" className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-ide-border/60 px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-medium text-ide-text">Layers</span>
          <span className="text-ide-text-muted" data-testid="physical-layer-count">{layers.length}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2" data-testid="physical-layer-list">
        {layers.map((layer) => {
          const visible = isLayoutLayerVisible(visibleLayerIndices, layer.index);
          const color = getPhysicalLayoutLayerColor(layer.index);

          return (
            <div
              key={`${layer.index}:${layer.name}`}
              data-testid={`physical-layer-row-${layer.index}`}
              className={cn(
                'flex min-h-7 items-center gap-2 rounded px-1.5 py-1 text-[11px]',
                visible ? 'text-ide-text' : 'text-ide-text-muted',
              )}
            >
              <button
                type="button"
                aria-label={`Toggle layer ${layer.name}`}
                aria-pressed={visible}
                className={cn(
                  'size-3.5 shrink-0 rounded-sm border border-white/20 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ide-accent',
                  visible ? 'opacity-100' : 'opacity-35',
                )}
                data-testid={`physical-layer-swatch-${layer.index}`}
                onClick={() => onLayerVisibilityToggle?.(layer.index)}
                style={{ backgroundColor: color.cssColor }}
              />
              <span
                className={cn('min-w-0 truncate', !visible && 'opacity-60')}
                data-testid={`physical-layer-name-${layer.index}`}
                title={layer.name}
              >
                {layer.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PhysicalReportsSummary({ layoutState }: { layoutState?: PhysicalWorkspaceLayoutState }) {
  if (!layoutState || layoutState.status === 'idle' || layoutState.status === 'loading') {
    return (
      <PhysicalEmptyState
        testId="physical-bottom-panel-reports-content"
        title="Reports"
        description="Layout summary will appear after the IHP stdcell LEF opens."
      />
    );
  }

  return (
    <div data-testid="physical-bottom-panel-reports-content" className="grid h-full min-h-0 grid-cols-4 gap-3 overflow-auto p-3 text-[11px]">
      <PhysicalMetricTile label="Status" value={layoutState.status} />
      <PhysicalMetricTile label="Macros" value={String(layoutState.catalog?.macros.length ?? 0)} />
      <PhysicalMetricTile label="Layers" value={String(layoutState.catalog?.layers.length ?? 0)} />
      <PhysicalMetricTile label="Shapes" value={String(layoutState.geometry?.shapes.length ?? 0)} />
      {layoutState.error && (
        <div className="col-span-4 rounded border border-ide-error/40 bg-ide-error/10 px-3 py-2 text-ide-error">
          {layoutState.error}
        </div>
      )}
    </div>
  );
}

function PhysicalMetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-ide-border/70 bg-ide-panel px-3 py-2">
      <p className="text-[10px] uppercase tracking-normal text-ide-text-muted">{label}</p>
      <p className="mt-1 truncate text-[12px] font-medium text-ide-text">{value}</p>
    </div>
  );
}

function sanitizeMacroTestId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function PhysicalLowerPanel<TTab extends PhysicalLowerPanelTab>({
  isExpanded,
  items,
  panelContent,
  testId,
}: {
  isExpanded: boolean;
  items: readonly IconTabToggleGroupItem[];
  panelContent: Record<TTab, ReactNode>;
  testId: string;
}) {
  const { layoutMode } = useCodeViewerLayout();
  const [tab, setTab] = useState<TTab>('details' as TTab);
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
      <div data-testid={`${testId}-tab-bar`} className={getPanelHeaderClassName(layoutMode)}>
        <IconTabToggleGroup
          items={items}
          value={tab}
          onValueChange={(nextValue) => setTab(nextValue as TTab)}
          groupLabel="Physical lower panel tabs"
          groupTestId={`${testId}-tabs`}
          tooltipSide="bottom"
          itemClassName={compactIconTabToggleItemClassName}
          iconSize={compactIconTabToggleIconSize}
        />
      </div>
      <div data-testid={`${testId}-content`} className="min-h-0 flex-1 overflow-hidden">
        {panelContent[tab]}
      </div>
    </section>
  );
}

export function PhysicalLeftPanel({
  catalog,
  onSplitPanelVisibleChange,
  onMacroActivate,
  selectedMacroName,
}: {
  catalog?: LspLayoutCatalog | null;
  onSplitPanelVisibleChange?: (isVisible: boolean) => void;
  onMacroActivate?: (macroName: string) => void;
  selectedMacroName?: string | null;
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
        <PhysicalMacroList
          catalog={catalog}
          selectedMacroName={selectedMacroName}
          onMacroActivate={onMacroActivate}
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
  const lowerContent = useMemo<Record<PhysicalLowerPanelTab, ReactNode>>(() => ({
    details: (
      <PhysicalEmptyState
        testId="physical-left-lower-panel-details-content"
        title="Layer Details"
        description="Floorplan layer details and visibility presets will appear here."
      />
    ),
    notes: (
      <PhysicalEmptyState
        testId="physical-left-lower-panel-notes-content"
        title="Notes"
        description="Physical layer notes and scratch data will appear here."
      />
    ),
  }), []);

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
              items={physicalLeftLowerPanelTabs}
              panelContent={lowerContent}
              isExpanded={splitPanelPresence.isExpanded}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  );
}

export function PhysicalRightPanel({
  layoutState,
  onLayerVisibilityToggle,
  onSplitPanelVisibleChange,
  selectedMacroName,
  visibleLayerIndices = emptyVisibleLayoutLayerSet,
}: {
  layoutState?: PhysicalWorkspaceLayoutState;
  onLayerVisibilityToggle?: (layerIndex: number) => void;
  onSplitPanelVisibleChange?: (isVisible: boolean) => void;
  selectedMacroName?: string | null;
  visibleLayerIndices?: VisibleLayoutLayerSet;
}) {
  const { layoutMode } = useCodeViewerLayout();
  const [tab, setTab] = useState<PhysicalRightPanelTab>('layers');
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
      {tab === 'layers' ? (
        <PhysicalLayerPanel
          catalog={layoutState?.catalog}
          visibleLayerIndices={visibleLayerIndices}
          onLayerVisibilityToggle={onLayerVisibilityToggle}
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
  const lowerContent = useMemo<Record<PhysicalLowerPanelTab, ReactNode>>(() => ({
    details: (
      <PhysicalInspectorSummary
        layoutState={layoutState}
        selectedMacroName={selectedMacroName}
      />
    ),
    notes: (
      <PhysicalEmptyState
        testId="physical-right-lower-panel-notes-content"
        title="Notes"
        description="Physical checks and selected object notes will appear here."
      />
    ),
  }), [layoutState, selectedMacroName]);

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
              items={physicalRightLowerPanelTabs}
              panelContent={lowerContent}
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
  layoutState,
  onClose,
  onMaximizeToggle,
}: {
  isMaximized?: boolean;
  layoutState?: PhysicalWorkspaceLayoutState;
  onClose?: () => void;
  onMaximizeToggle?: () => void;
}) {
  const { layoutMode } = useCodeViewerLayout();
  const [tab, setTab] = useState<PhysicalBottomPanelTab>('reports');
  const MaximizeIcon = isMaximized ? Minimize2 : Maximize;
  const maximizeLabel = isMaximized ? 'Restore Panel' : 'Maximize Panel';
  const panelContent = useMemo<Record<PhysicalBottomPanelTab, ReactNode>>(() => ({
    reports: (
      <PhysicalReportsSummary layoutState={layoutState} />
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
