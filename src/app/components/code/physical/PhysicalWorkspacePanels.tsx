import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ClipboardList,
  Boxes,
  ChevronRight,
  CircuitBoard,
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
import { Slider } from '../../ui/slider';
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
  createPhysicalLayoutLayerTree,
  formatPhysicalLayoutLayerOpacity,
  getPhysicalLayoutLayerColor,
  getPhysicalLayoutLayerCategories,
  getPhysicalLayoutLayerCategoryColor,
  getPhysicalLayoutLayerOpacity,
  getPhysicalLayoutOutlineColor,
  getPhysicalLayoutShapeCategory,
  isPhysicalLayoutLayerCategoryVisible,
  isPhysicalLayoutOutlineVisible,
  normalizePhysicalLayoutLayerOpacity,
  physicalLayoutLayerOpacityMax,
  physicalLayoutLayerOpacityMin,
  physicalLayoutLayerOpacityStep,
  type PhysicalLayoutLayerCategory,
  type PhysicalLayoutVisibility,
} from './physicalLayoutLayers';
import { selectLayoutTargetShapes, shapeBounds, type PhysicalLayoutTarget } from './physicalLayoutGeometry';

type PhysicalLeftPanelTab = 'layout' | 'constraints';
type PhysicalLowerPanelTab = 'details' | 'notes';
type PhysicalRightPanelTab = 'layers' | 'checks';
type PhysicalBottomPanelTab = 'reports' | 'console';

export interface PhysicalWorkspaceLayoutState {
  catalog: LspLayoutCatalog | null;
  error: string | null;
  geometry: LspLayoutGeometry | null;
  openResult: LspLayoutOpenResult | null;
  status: PhysicalLayoutStatus;
}

export interface PhysicalLayoutFileEntry {
  extension: string;
  name: string;
  path: string;
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

const emptyPhysicalLayoutVisibility: PhysicalLayoutVisibility = {
  layerOpacities: new Map(),
  outlineVisible: false,
  visibleItems: new Set(),
};

const physicalLayerCategoryLabels: Record<PhysicalLayoutLayerCategory, string> = {
  blockage: 'Blockage',
  boundary: 'Boundary',
  label: 'Label',
  net: 'Net',
  obstruction: 'Obstruction',
  path: 'Path',
  pin: 'Pin',
  specialNet: 'Special Net',
  text: 'Text',
};

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
  activeLayoutFilePath,
  highlightedShapeIndex,
  layoutVisibility,
  onGdsTileGeometryChange,
  onHighlightedShapeChange,
  onLayoutStateChange,
  onSelectedTargetChange,
  selectedTarget,
}: {
  activeLayoutFilePath: string | null;
  highlightedShapeIndex?: number | null;
  layoutVisibility: PhysicalLayoutVisibility;
  onGdsTileGeometryChange?: (geometry: LspLayoutGeometry | null) => void;
  onHighlightedShapeChange?: (shapeIndex: number | null) => void;
  onLayoutStateChange?: (state: PhysicalLayoutStateSnapshot) => void;
  onSelectedTargetChange?: (target: PhysicalLayoutTarget | null) => void;
  selectedTarget?: PhysicalLayoutTarget | null;
}) {
  const { layoutMode } = useCodeViewerLayout();

  return (
    <div className={getEditorAreaRootClassName(layoutMode)}>
      <div data-testid="physical-main-panel-content" className="h-full min-h-0">
        <PhysicalLayoutEditorPanel
          activeLayoutFilePath={activeLayoutFilePath}
          highlightedShapeIndex={highlightedShapeIndex ?? null}
          layoutVisibility={layoutVisibility}
          selectedTarget={selectedTarget ?? null}
          onGdsTileGeometryChange={onGdsTileGeometryChange}
          onHighlightedShapeChange={onHighlightedShapeChange}
          onLayoutStateChange={onLayoutStateChange}
          onSelectedTargetChange={onSelectedTargetChange}
        />
      </div>
    </div>
  );
}

function PhysicalLayoutFileTree({
  activeFilePath,
  catalog,
  expandedFilePaths,
  files,
  onFileToggle,
  onTargetActivate,
  selectedTarget,
}: {
  activeFilePath?: string | null;
  catalog?: LspLayoutCatalog | null;
  expandedFilePaths: ReadonlySet<string>;
  files: readonly PhysicalLayoutFileEntry[];
  onFileToggle?: (file: PhysicalLayoutFileEntry) => void;
  onTargetActivate?: (target: PhysicalLayoutTarget) => void;
  selectedTarget?: PhysicalLayoutTarget | null;
}) {
  if (files.length === 0) {
    return (
      <PhysicalEmptyState
        testId="physical-left-panel-layout-content"
        title="Layout"
        description="Workspace layout files will appear here."
      />
    );
  }

  return (
    <div data-testid="physical-left-panel-layout-content" className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-ide-border/60 px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-medium text-ide-text">Layout Files</span>
          <span className="text-ide-text-muted" data-testid="physical-layout-file-count">{files.length}</span>
        </div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto px-1 py-1"
        data-testid="physical-layout-file-tree"
      >
        {files.map((file) => {
          const active = file.path === activeFilePath;
          const expanded = expandedFilePaths.has(file.path);
          const targets = active && catalog ? createLayoutFileTargets(catalog) : [];
          const hasChildren = targets.length > 0;
          const FileIcon = getPhysicalLayoutFileIcon(file.extension);
          const fileIconColor = getPhysicalLayoutFileIconColor(file.extension);
          return (
            <div key={file.path}>
              <button
                type="button"
                aria-expanded={expanded}
                aria-selected={active}
                className={cn(
                  'flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-left text-[11px] hover:bg-ide-hover',
                  active ? 'bg-ide-selection text-ide-text' : 'text-ide-text-muted',
                )}
                data-testid={`physical-layout-file-item-${sanitizeLayoutTestId(file.path)}`}
                onClick={() => onFileToggle?.(file)}
                title={file.path}
              >
                <ChevronRight
                  size={12}
                  className={cn('shrink-0 transition-transform', expanded && hasChildren && 'rotate-90', !hasChildren && 'opacity-30')}
                />
                <FileIcon
                  size={13}
                  className="shrink-0"
                  data-icon-color={fileIconColor}
                  data-testid={`physical-layout-file-icon-${sanitizeLayoutTestId(file.path)}`}
                  style={{ color: fileIconColor }}
                />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
              </button>

              {expanded && hasChildren && (
                <div className="ml-5 mt-0.5 flex flex-col gap-0.5">
                  {targets.map((target) => {
                    const selected = selectedTarget?.kind === target.kind && selectedTarget.name === target.name;
                    const TargetIcon = target.kind === 'gdsCell' ? Boxes : target.kind === 'design' ? CircuitBoard : Layers3;
                    const targetIconColor = getPhysicalLayoutTargetIconColor(target);
                    return (
                      <button
                        key={`${target.kind}:${target.name}`}
                        type="button"
                        aria-selected={selected}
                        className={cn(
                          'flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] hover:bg-ide-hover',
                          selected ? 'bg-ide-selection text-ide-text' : 'text-ide-text-muted',
                        )}
                        data-testid={`physical-layout-target-item-${sanitizeLayoutTestId(target.kind)}-${sanitizeLayoutTestId(target.name)}`}
                        onClick={() => onTargetActivate?.(target)}
                        title={target.name}
                      >
                        <TargetIcon
                          size={12}
                          className="shrink-0"
                          data-icon-color={targetIconColor}
                          data-testid={`physical-layout-target-icon-${sanitizeLayoutTestId(target.kind)}-${sanitizeLayoutTestId(target.name)}`}
                          style={{ color: targetIconColor }}
                        />
                        <span className="min-w-0 flex-1 truncate">{target.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PhysicalInspectorSummary({
  gdsInspectorGeometry,
  highlightedShapeIndex,
  layoutState,
  selectedTarget,
}: {
  gdsInspectorGeometry?: LspLayoutGeometry | null;
  highlightedShapeIndex?: number | null;
  layoutState?: PhysicalWorkspaceLayoutState;
  selectedTarget?: PhysicalLayoutTarget | null;
}) {
  const catalog = layoutState?.catalog ?? null;
  const geometry = catalog?.sourceKind === 'gds' && selectedTarget?.kind === 'gdsCell'
    ? gdsInspectorGeometry ?? null
    : layoutState?.geometry ?? null;
  const macro = selectedTarget?.kind === 'macro'
    ? catalog?.macros.find((entry) => entry.name === selectedTarget.name) ?? null
    : null;
  const cell = selectedTarget?.kind === 'gdsCell'
    ? catalog?.gdsCells.find((entry) => entry.name === selectedTarget.name) ?? null
    : null;
  const highlightedShape = highlightedShapeIndex === null || highlightedShapeIndex === undefined
    ? null
    : selectLayoutTargetShapes(catalog, geometry, selectedTarget).find((shape) => shape.index === highlightedShapeIndex) ?? null;

  if (!selectedTarget) {
    return (
      <PhysicalEmptyState
        testId="physical-right-panel-inspector-content"
        title="Inspector"
        description="Select a layout target to inspect geometry metadata."
      />
    );
  }

  return (
    <div data-testid="physical-right-panel-inspector-content" className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3 text-[11px]">
      <div>
        <p className="font-medium text-ide-text">{selectedTarget.name}</p>
        <p className="mt-1 text-ide-text-muted">{selectedTarget.kind}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ide-text-muted">
        {macro && (
          <>
            <dt>Size</dt>
            <dd className="text-ide-text">{macro.sizeX.toFixed(3)} x {macro.sizeY.toFixed(3)}</dd>
            <dt>Origin</dt>
            <dd className="text-ide-text">{macro.originX.toFixed(3)}, {macro.originY.toFixed(3)}</dd>
            <dt>Pins</dt>
            <dd className="text-ide-text">{macro.pinCount}</dd>
          </>
        )}
        {cell && (
          <>
            <dt>Elements</dt>
            <dd className="text-ide-text">{cell.elementCount}</dd>
            <dt>References</dt>
            <dd className="text-ide-text">{cell.referenceCount}</dd>
          </>
        )}
        <dt>Layers</dt>
        <dd className="text-ide-text">{catalog?.layers.length ?? 0}</dd>
        <dt>Shapes</dt>
        <dd className="text-ide-text">{layoutState?.geometry?.shapes.length ?? 0}</dd>
      </dl>
      <PhysicalSelectedShapeInspector
        catalog={catalog}
        shape={highlightedShape}
      />
    </div>
  );
}

function PhysicalSelectedShapeInspector({
  catalog,
  shape,
}: {
  catalog: LspLayoutCatalog | null;
  shape: LspLayoutGeometry['shapes'][number] | null;
}) {
  if (!shape) {
    return (
      <div
        className="rounded border border-ide-border/70 bg-ide-panel/70 px-3 py-2 text-ide-text-muted"
        data-testid="physical-inspector-selected-shape-empty"
      >
        Click a visible shape to inspect it.
      </div>
    );
  }

  const bounds = shapeBounds(shape);
  const layer = catalog?.layers.find((entry) => entry.index === shape.layerIndex) ?? null;
  const category = getPhysicalLayoutShapeCategory(shape);
  const gdsElement = shape.ownerKind === 'gdsElement'
    ? catalog?.gdsElements[shape.ownerIndex] ?? null
    : null;

  return (
    <div
      className="rounded border border-ide-border/70 bg-ide-panel/70 px-3 py-2"
      data-testid="physical-inspector-selected-shape"
    >
      <p className="font-medium text-ide-text">Selected Shape</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ide-text-muted">
        <dt>Index</dt>
        <dd className="text-ide-text" data-testid="physical-inspector-selected-shape-index">{shape.index}</dd>
        <dt>Layer</dt>
        <dd className="text-ide-text" data-testid="physical-inspector-selected-shape-layer">
          {layer ? `${layer.name} (${layer.index})` : shape.layerIndex}
        </dd>
        <dt>Category</dt>
        <dd className="text-ide-text" data-testid="physical-inspector-selected-shape-category">{category ? physicalLayerCategoryLabels[category] : 'Unknown'}</dd>
        <dt>Kind</dt>
        <dd className="text-ide-text" data-testid="physical-inspector-selected-shape-kind">{shape.kind}</dd>
        <dt>Owner</dt>
        <dd className="text-ide-text">{shape.ownerKind} #{shape.ownerIndex}</dd>
        <dt>Macro</dt>
        <dd className="text-ide-text">{shape.macroIndex ?? 'global'}</dd>
        <dt>Bounds</dt>
        <dd className="text-ide-text" data-testid="physical-inspector-selected-shape-bounds">{formatLayoutBounds(bounds)}</dd>
        <dt>Points</dt>
        <dd className="text-ide-text">{shape.polygon?.length ?? 0}</dd>
        <dt>Flags</dt>
        <dd className="text-ide-text">{shape.flags}</dd>
        {gdsElement && (
          <>
            <dt>GDS</dt>
            <dd className="text-ide-text">
              {gdsElement.kind} L{gdsElement.layer}/{gdsElement.datatype}
              {gdsElement.text ? ` ${gdsElement.text}` : ''}
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

function formatLayoutBounds(bounds: ReturnType<typeof shapeBounds>): string {
  return `${bounds.x0.toFixed(3)}, ${bounds.y0.toFixed(3)} - ${bounds.x1.toFixed(3)}, ${bounds.y1.toFixed(3)}`;
}

function PhysicalLayerPanel({
  catalog,
  geometry,
  layoutVisibility,
  onLayerCategoryVisibilityToggle,
  onLayerOpacityChange,
  onOutlineVisibilityToggle,
  selectedTarget,
}: {
  catalog?: LspLayoutCatalog | null;
  geometry?: LspLayoutGeometry | null;
  layoutVisibility: PhysicalLayoutVisibility;
  onLayerCategoryVisibilityToggle?: (layerIndex: number, category: PhysicalLayoutLayerCategory) => void;
  onLayerOpacityChange?: (layerIndex: number, opacity: number) => void;
  onOutlineVisibilityToggle?: () => void;
  selectedTarget?: PhysicalLayoutTarget | null;
}) {
  const [expandedOpacityLayerIndex, setExpandedOpacityLayerIndex] = useState<number | null>(null);
  const layers = catalog?.layers ?? [];
  const selectedShapes = selectLayoutTargetShapes(catalog, geometry, selectedTarget);
  const layerTree = createPhysicalLayoutLayerTree(catalog, selectedShapes);
  const layerCategories = getPhysicalLayoutLayerCategories(catalog);
  const outlineAvailable = Boolean(selectedTarget);
  const outlineVisible = outlineAvailable && isPhysicalLayoutOutlineVisible(layoutVisibility);

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
        <div
          data-testid="physical-layer-outline-row"
          className={cn(
            'flex min-h-7 items-center gap-2 rounded px-1.5 py-1 text-[11px]',
            outlineAvailable ? 'text-ide-text' : 'text-ide-text-muted opacity-55',
          )}
          aria-disabled={!outlineAvailable}
        >
          <button
            type="button"
            aria-label="Toggle layout outline"
            aria-pressed={outlineVisible}
            disabled={!outlineAvailable}
            className={cn(
              'size-3.5 shrink-0 rounded-sm border border-white/20 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ide-accent disabled:cursor-not-allowed',
              outlineVisible ? 'opacity-100' : 'opacity-35',
              !outlineAvailable && 'opacity-25',
            )}
            data-testid="physical-layer-outline-swatch"
            onClick={onOutlineVisibilityToggle}
            style={{ backgroundColor: getPhysicalLayoutOutlineColor().cssColor }}
          />
          <span
            className={cn('min-w-0 truncate', !outlineVisible && 'opacity-60')}
            data-testid="physical-layer-outline-name"
          >
            Outline
          </span>
        </div>

        {layerTree.map((entry) => {
          const { layer } = entry;
          const layerOpacity = getPhysicalLayoutLayerOpacity(layoutVisibility, layer.index);
          const isOpacityExpanded = expandedOpacityLayerIndex === layer.index;
          return (
            <div
              key={`${layer.index}:${layer.name}`}
              data-testid={`physical-layer-row-${layer.index}`}
              className="rounded px-1.5 py-1 text-[11px] text-ide-text"
              aria-disabled={false}
            >
              <div
                className="flex min-h-6 items-center gap-2"
                data-testid={`physical-layer-opacity-row-${layer.index}`}
              >
                <button
                  type="button"
                  aria-expanded={isOpacityExpanded}
                  aria-label={`Set ${layer.name} opacity`}
                  className="min-w-0 shrink rounded px-0.5 py-0 text-left text-[11px] font-medium leading-5 text-ide-text transition-colors hover:bg-ide-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ide-accent"
                  data-testid={`physical-layer-opacity-button-${layer.index}`}
                  onClick={() => setExpandedOpacityLayerIndex(isOpacityExpanded ? null : layer.index)}
                  title={`${layer.name} opacity ${formatPhysicalLayoutLayerOpacity(layerOpacity)}`}
                >
                  <span
                    className="min-w-0 truncate"
                    data-testid={`physical-layer-name-${layer.index}`}
                  >
                    {layer.name}
                  </span>
                </button>
                {isOpacityExpanded && (
                  <>
                    <button
                      type="button"
                      aria-label={`Decrease ${layer.name} opacity`}
                      className="flex size-4 shrink-0 items-center justify-center rounded border border-ide-border/70 text-[10px] leading-none text-ide-text-muted transition-colors hover:bg-ide-hover hover:text-ide-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ide-accent"
                      data-testid={`physical-layer-opacity-decrease-${layer.index}`}
                      onClick={() => onLayerOpacityChange?.(
                        layer.index,
                        normalizePhysicalLayoutLayerOpacity(layerOpacity - physicalLayoutLayerOpacityStep),
                      )}
                    >
                      -
                    </button>
                    <Slider
                      aria-label={`Set ${layer.name} opacity`}
                      className="h-4 min-w-14 flex-1"
                      data-testid={`physical-layer-opacity-slider-${layer.index}`}
                      max={physicalLayoutLayerOpacityMax}
                      min={physicalLayoutLayerOpacityMin}
                      onValueChange={(value) => onLayerOpacityChange?.(layer.index, value[0] ?? 1)}
                      step={physicalLayoutLayerOpacityStep}
                      value={[layerOpacity]}
                    />
                    <button
                      type="button"
                      aria-label={`Increase ${layer.name} opacity`}
                      className="flex size-4 shrink-0 items-center justify-center rounded border border-ide-border/70 text-[10px] leading-none text-ide-text-muted transition-colors hover:bg-ide-hover hover:text-ide-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ide-accent"
                      data-testid={`physical-layer-opacity-increase-${layer.index}`}
                      onClick={() => onLayerOpacityChange?.(
                        layer.index,
                        normalizePhysicalLayoutLayerOpacity(layerOpacity + physicalLayoutLayerOpacityStep),
                      )}
                    >
                      +
                    </button>
                  </>
                )}
                <span
                    className="ml-auto shrink-0 text-[10px] font-normal tabular-nums text-ide-text-muted"
                    data-testid={`physical-layer-opacity-value-${layer.index}`}
                  >
                    {formatPhysicalLayoutLayerOpacity(layerOpacity)}
                </span>
              </div>
              <div
                className="mt-0.5 grid grid-cols-3 gap-x-1 gap-y-0.5 pl-3"
                data-testid={`physical-layer-category-grid-${layer.index}`}
              >
                {layerCategories.map((category) => {
                  const available = entry.categories[category];
                  const visible = available && isPhysicalLayoutLayerCategoryVisible(layoutVisibility, layer.index, category);
                  const label = physicalLayerCategoryLabels[category];
                  const color = getPhysicalLayoutLayerCategoryColor(layer.index, category);

                  return (
                    <div
                      key={category}
                      aria-disabled={!available}
                      className={cn(
                        'flex min-h-6 min-w-0 items-center gap-1.5 rounded px-1 py-0.5',
                        available ? 'text-ide-text' : 'text-ide-text-muted opacity-75',
                      )}
                      data-testid={`physical-layer-category-row-${layer.index}-${category}`}
                    >
                      <button
                        type="button"
                        aria-label={`Toggle ${layer.name} ${label}`}
                        aria-pressed={visible}
                        disabled={!available}
                        className={cn(
                          'size-3.5 shrink-0 rounded-sm border border-white/20 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ide-accent disabled:cursor-not-allowed',
                          visible ? 'opacity-100' : 'opacity-35',
                          !available && 'opacity-45',
                        )}
                        data-testid={`physical-layer-category-swatch-${layer.index}-${category}`}
                        onClick={() => onLayerCategoryVisibilityToggle?.(layer.index, category)}
                        style={{ backgroundColor: color.cssColor }}
                      />
                      <span
                        className={cn('min-w-0 truncate', !visible && available && 'opacity-60')}
                        data-testid={`physical-layer-category-name-${layer.index}-${category}`}
                        title={label}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
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

function sanitizeLayoutTestId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function createLayoutFileTargets(catalog: LspLayoutCatalog): PhysicalLayoutTarget[] {
  if (catalog.sourceKind === 'gds') {
    return catalog.gdsCells.map((cell) => ({
      kind: 'gdsCell',
      name: cell.name,
      index: cell.index,
    }));
  }

  if (catalog.defPins.length > 0 || catalog.components.length > 0 || catalog.nets.length > 0) {
    return [{ kind: 'design', name: 'Design', index: null }];
  }

  return catalog.macros.map((macro) => ({
    kind: 'macro',
    name: macro.name,
    index: macro.index,
  }));
}

function getPhysicalLayoutFileIcon(extension: string) {
  if (extension === '.gds' || extension === '.gdsii') {
    return CircuitBoard;
  }
  if (extension === '.def') {
    return Boxes;
  }

  return FileText;
}

function getPhysicalLayoutFileIconColor(extension: string) {
  if (extension === '.gds' || extension === '.gdsii') {
    return getPhysicalLayoutLayerColor(2).cssColor;
  }
  if (extension === '.def') {
    return getPhysicalLayoutLayerColor(1).cssColor;
  }
  if (extension === '.lef') {
    return getPhysicalLayoutLayerColor(0).cssColor;
  }
  if (extension === '.oas' || extension === '.oasis') {
    return getPhysicalLayoutLayerColor(4).cssColor;
  }

  return getPhysicalLayoutOutlineColor().cssColor;
}

function getPhysicalLayoutTargetIconColor(target: PhysicalLayoutTarget) {
  if (target.kind === 'gdsCell') {
    return getPhysicalLayoutLayerColor(2).cssColor;
  }
  if (target.kind === 'design') {
    return getPhysicalLayoutLayerColor(1).cssColor;
  }

  return getPhysicalLayoutLayerColor(0).cssColor;
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
  activeLayoutFilePath,
  catalog,
  expandedLayoutFilePaths,
  layoutFiles,
  onSplitPanelVisibleChange,
  onLayoutFileToggle,
  onLayoutTargetActivate,
  selectedTarget,
}: {
  activeLayoutFilePath?: string | null;
  catalog?: LspLayoutCatalog | null;
  expandedLayoutFilePaths: ReadonlySet<string>;
  layoutFiles: readonly PhysicalLayoutFileEntry[];
  onSplitPanelVisibleChange?: (isVisible: boolean) => void;
  onLayoutFileToggle?: (file: PhysicalLayoutFileEntry) => void;
  onLayoutTargetActivate?: (target: PhysicalLayoutTarget) => void;
  selectedTarget?: PhysicalLayoutTarget | null;
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
        <PhysicalLayoutFileTree
          activeFilePath={activeLayoutFilePath}
          catalog={catalog}
          expandedFilePaths={expandedLayoutFilePaths}
          files={layoutFiles}
          selectedTarget={selectedTarget}
          onFileToggle={onLayoutFileToggle}
          onTargetActivate={onLayoutTargetActivate}
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
  gdsInspectorGeometry,
  highlightedShapeIndex,
  layoutState,
  layoutVisibility = emptyPhysicalLayoutVisibility,
  onLayerCategoryVisibilityToggle,
  onLayerOpacityChange,
  onOutlineVisibilityToggle,
  onSplitPanelVisibleChange,
  selectedTarget,
}: {
  gdsInspectorGeometry?: LspLayoutGeometry | null;
  highlightedShapeIndex?: number | null;
  layoutState?: PhysicalWorkspaceLayoutState;
  layoutVisibility?: PhysicalLayoutVisibility;
  onLayerCategoryVisibilityToggle?: (layerIndex: number, category: PhysicalLayoutLayerCategory) => void;
  onLayerOpacityChange?: (layerIndex: number, opacity: number) => void;
  onOutlineVisibilityToggle?: () => void;
  onSplitPanelVisibleChange?: (isVisible: boolean) => void;
  selectedTarget?: PhysicalLayoutTarget | null;
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
          geometry={layoutState?.geometry}
          layoutVisibility={layoutVisibility}
          selectedTarget={selectedTarget}
          onLayerCategoryVisibilityToggle={onLayerCategoryVisibilityToggle}
          onLayerOpacityChange={onLayerOpacityChange}
          onOutlineVisibilityToggle={onOutlineVisibilityToggle}
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
        gdsInspectorGeometry={gdsInspectorGeometry}
        highlightedShapeIndex={highlightedShapeIndex}
        layoutState={layoutState}
        selectedTarget={selectedTarget}
      />
    ),
    notes: (
      <PhysicalEmptyState
        testId="physical-right-lower-panel-notes-content"
        title="Notes"
        description="Physical checks and selected object notes will appear here."
      />
    ),
  }), [gdsInspectorGeometry, highlightedShapeIndex, layoutState, selectedTarget]);

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
