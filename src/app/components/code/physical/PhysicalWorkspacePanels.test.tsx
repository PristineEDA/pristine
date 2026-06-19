import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { layoutFixtureGdsGeometry, layoutFixtureGdsOpenResult, layoutFixtureGeometry, layoutFixtureOpenResult } from '../../../../test/layoutFixture';
import type { LspLayoutCatalog, LspLayoutGeometry } from '../../../../../types/systemverilog-lsp';
import { CodeViewerLayoutProvider } from '../../../context/CodeViewerLayoutContext';
import {
  PhysicalBottomPanel,
  PhysicalLeftPanel,
  PhysicalMainPanel,
  PhysicalRightPanel,
  type PhysicalWorkspaceLayoutState,
} from './PhysicalWorkspacePanels';
import {
  createPhysicalLayoutVisibility,
  formatPhysicalLayoutLayerOpacitySummary,
  filterVisiblePhysicalLayoutShapes,
  hasNonDefaultPhysicalLayoutLayerOpacity,
  isPhysicalLayoutOutlineVisible,
  type PhysicalLayoutVisibility,
} from './physicalLayoutLayers';
import { selectMacroShapes, type PhysicalLayoutTarget } from './physicalLayoutGeometry';

vi.mock('./PhysicalLayoutCanvas', () => ({
  PhysicalLayoutCanvas: ({
    catalog,
    geometry,
    highlightedShapeIndex,
    layoutVisibility,
    onGdsTileGeometryChange,
    onGdsTileMetricsChange,
    onHighlightedShapeChange,
    selectedTarget,
  }: {
    catalog: LspLayoutCatalog | null;
    geometry: LspLayoutGeometry | null;
    highlightedShapeIndex?: number | null;
    layoutVisibility: PhysicalLayoutVisibility;
    onGdsTileGeometryChange?: (geometry: LspLayoutGeometry | null) => void;
    onGdsTileMetricsChange?: (metrics: any) => void;
    onHighlightedShapeChange?: (shapeIndex: number | null) => void;
    selectedTarget: PhysicalLayoutTarget | null;
  }) => {
    const activeGeometry = catalog?.sourceKind === 'gds' ? layoutFixtureGdsGeometry : geometry;
    useEffect(() => {
      if (catalog?.sourceKind !== 'gds') {
        return;
      }

      window.setTimeout(() => {
        onGdsTileGeometryChange?.(layoutFixtureGdsGeometry);
        onGdsTileMetricsChange?.({
        averageFps: 60,
        bufferByteLength: 256,
        cacheHitCount: 0,
        cacheMissCount: 1,
        continuationCount: 0,
        frameP95Ms: 16,
        indexByteLength: 64,
        lastFps: 60,
        lastFrameMs: 16,
        lastRenderMs: 1.2,
        lastTileQueryMs: 0.4,
        lastTileRoundtripMs: 2.5,
        meshBatchCount: 2,
        meshDrawNodeCount: 3,
        meshIndexCount: 6,
        meshVertexCount: 4,
        tileRequestCount: 1,
        truncated: false,
        visiblePointCount: 4,
        visibleShapeCount: layoutFixtureGdsGeometry.shapes.length,
      });
      }, 0);
    }, [catalog?.sourceKind, onGdsTileGeometryChange, onGdsTileMetricsChange]);

    return (
      <div
        data-gds-draw-node-count={catalog?.sourceKind === 'gds' ? 3 : 0}
        data-gds-mesh-batch-count={catalog?.sourceKind === 'gds' ? 2 : 0}
        data-gds-render-batch-mode={catalog?.sourceKind === 'gds' ? 'order-bucket' : 'none'}
        data-gds-render-bucket-size={catalog?.sourceKind === 'gds' ? 1 : 0}
        data-gds-render-mode={catalog?.sourceKind === 'gds' ? 'tile-mesh' : 'full-graphics'}
        data-highlighted-shape-index={highlightedShapeIndex ?? ''}
        data-layer-opacity-summary={formatPhysicalLayoutLayerOpacitySummary(layoutVisibility)}
        data-layer-count={catalog?.layers.length ?? 0}
        data-macro-count={catalog?.macros.length ?? 0}
        data-renderer="webgl"
        data-selected-macro-name={selectedTarget?.kind === 'macro' ? selectedTarget.name : ''}
        data-shape-count={activeGeometry?.shapes.length ?? 0}
        data-outline-visible={isPhysicalLayoutOutlineVisible(layoutVisibility) ? 'true' : 'false'}
        data-testid="physical-layout-canvas"
        data-visible-label-names="A|Y"
        data-visible-shape-count={activeGeometry ? filterVisiblePhysicalLayoutShapes(activeGeometry.shapes, layoutVisibility).length : 0}
        onClick={() => onHighlightedShapeChange?.(activeGeometry?.shapes[0]?.index ?? null)}
      />
    );
  },
}));

vi.mock('./PhysicalLayout3DCanvas', () => ({
  PhysicalLayout3DCanvas: ({
    catalog,
    geometry,
    highlightedShapeIndex,
    layoutVisibility,
    onHighlightedShapeChange,
    selectedTarget,
  }: {
    catalog: LspLayoutCatalog | null;
    geometry: LspLayoutGeometry | null;
    highlightedShapeIndex?: number | null;
    layoutVisibility: PhysicalLayoutVisibility;
    onHighlightedShapeChange?: (shapeIndex: number | null) => void;
    selectedTarget: PhysicalLayoutTarget | null;
  }) => (
    <div
      data-base-grid-depth-test="true"
      data-depth-write-mode="solid-mesh"
      data-highlighted-shape-index={highlightedShapeIndex ?? ''}
      data-layer-opacity-summary={formatPhysicalLayoutLayerOpacitySummary(layoutVisibility)}
      data-material-side="double"
      data-orbit-origin="bounds3d"
      data-orbit-render-mode="raf-ref-interaction-idle-sync"
      data-pan-x="0.0000"
      data-pan-y="0.0000"
      data-renderer="three-webgl"
      data-scene-center-offset-x="2.0000"
      data-scene-center-offset-y="1.5000"
      data-scene-center-offset-z="0.0625"
      data-selected-target-name={selectedTarget?.name ?? ''}
      data-shape-opacity-mode={hasNonDefaultPhysicalLayoutLayerOpacity(layoutVisibility) ? 'layered' : 'opaque'}
      data-shape-count={geometry?.shapes.length ?? 0}
      data-source-kind={catalog?.sourceKind ?? ''}
      data-testid="physical-layout-3d-canvas"
      data-viewport-framed="true"
      data-viewport-left-border="false"
      data-visible-shape-count={geometry?.shapes.length ?? 0}
      data-view-helper-animating="false"
      data-view-helper-last-axis=""
      data-view-helper-pos-x-screen-x="96.00"
      data-view-helper-pos-x-screen-y="64.00"
      data-view-helper-background="transparent"
      data-view-helper-size="112"
      data-view-helper-visible="true"
      data-zoom="1.0000"
      onClick={() => onHighlightedShapeChange?.(geometry?.shapes[1]?.index ?? null)}
    />
  ),
}));

const readyLayoutState: PhysicalWorkspaceLayoutState = {
  catalog: layoutFixtureOpenResult.catalog,
  error: null,
  geometry: layoutFixtureGeometry,
  openResult: layoutFixtureOpenResult,
  status: 'ready',
};
const readyMacroShapes = selectMacroShapes(layoutFixtureOpenResult.catalog, layoutFixtureGeometry, 'sg13g2_inv_1');
const readyTarget: PhysicalLayoutTarget = { kind: 'macro', name: 'sg13g2_inv_1', index: 0 };
const readyVisibility = createPhysicalLayoutVisibility(layoutFixtureOpenResult.catalog, true, readyMacroShapes);
const nandMacroShapes = selectMacroShapes(layoutFixtureOpenResult.catalog, layoutFixtureGeometry, 'sg13g2_nand2_1');
const nandTarget: PhysicalLayoutTarget = { kind: 'macro', name: 'sg13g2_nand2_1', index: 1 };
const nandVisibility = createPhysicalLayoutVisibility(layoutFixtureOpenResult.catalog, true, nandMacroShapes);
const readyGdsTarget: PhysicalLayoutTarget = { kind: 'gdsCell', name: 'CHILD', index: 1 };
const layoutFiles = [
  { extension: '.lef', name: 'sg13g2_stdcell.lef', path: 'sg13g2_stdcell.lef' },
  { extension: '.gds', name: 'chip.gds', path: 'chip.gds' },
];

function renderInCodeLayout(node: ReactNode) {
  return render(
    <CodeViewerLayoutProvider>
      {node}
    </CodeViewerLayoutProvider>,
  );
}

function getTestElectronApi() {
  if (!window.electronAPI) {
    throw new Error('Electron API mock is not installed.');
  }

  return window.electronAPI;
}

describe('PhysicalWorkspacePanels', () => {
  it('renders the main physical layout editor content', async () => {
    const onLayoutStateChange = vi.fn();
    const onSelectedTargetChange = vi.fn();

    function PhysicalMainPanelHarness() {
      const [selectedTarget, setSelectedTarget] = useState<PhysicalLayoutTarget | null>(null);

      return (
        <PhysicalMainPanel
          activeLayoutFilePath="sg13g2_stdcell.lef"
          layoutVisibility={readyVisibility}
          selectedTarget={selectedTarget}
          onLayoutStateChange={onLayoutStateChange}
          onSelectedTargetChange={(target) => {
            onSelectedTargetChange(target);
            setSelectedTarget(target);
          }}
        />
      );
    }

    renderInCodeLayout(
      <PhysicalMainPanelHarness />,
    );

    expect(screen.getByTestId('physical-layout-editor')).toBeInTheDocument();
    expect(screen.getByTestId('physical-layout-3d-toggle')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('physical-layout-editor')).toHaveAttribute('data-status', 'ready'));
    expect(screen.getByTestId('physical-layout-canvas')).toHaveAttribute('data-renderer', 'webgl');
    await waitFor(() => expect(onSelectedTargetChange).toHaveBeenCalledWith(readyTarget));
    await waitFor(() => expect(getTestElectronApi().lsp.layoutGeometry).toHaveBeenCalledWith({
      sessionId: 'layout-test-session',
      maxShapes: 0,
      macroIndices: [0],
    }));
    await waitFor(() => expect(onLayoutStateChange).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ready',
      catalog: layoutFixtureOpenResult.catalog,
      geometry: expect.objectContaining({ shapeCount: 3 }),
    })));
  });

  it('toggles the 3D split and shows an empty 3D state for non-GDS targets', async () => {
    const user = userEvent.setup();

    function PhysicalMainPanelHarness() {
      const [selectedTarget, setSelectedTarget] = useState<PhysicalLayoutTarget | null>(null);

      return (
        <PhysicalMainPanel
          activeLayoutFilePath="sg13g2_stdcell.lef"
          layoutVisibility={readyVisibility}
          selectedTarget={selectedTarget}
          onSelectedTargetChange={setSelectedTarget}
        />
      );
    }

    renderInCodeLayout(<PhysicalMainPanelHarness />);

    await waitFor(() => expect(screen.getByTestId('physical-layout-editor')).toHaveAttribute('data-status', 'ready'));
    await user.click(screen.getByTestId('physical-layout-3d-toggle'));

    expect(screen.getByTestId('physical-layout-editor')).toHaveAttribute('data-3d-visible', 'true');
    expect(screen.getByTestId('physical-layout-3d-split')).toBeInTheDocument();
    expect(screen.getByTestId('panel-physical-layout-2d-panel')).toHaveAttribute('data-default-size', '50');
    expect(screen.getByTestId('panel-physical-layout-3d-panel')).toHaveAttribute('data-default-size', '50');
    expect(screen.getByTestId('physical-layout-3d-resize-handle')).toBeInTheDocument();
    expect(screen.getByTestId('physical-layout-3d-resize-indicator')).toHaveClass('bg-[var(--ide-text-dim)]');
    expect(screen.getByTestId('physical-layout-3d-empty')).toHaveTextContent('GDS cell');
  });

  it('uses tile-mesh rendering instead of full geometry for selected GDS cells', async () => {
    const layoutOpen = vi.mocked(getTestElectronApi().lsp.layoutOpen);
    const layoutGeometry = vi.mocked(getTestElectronApi().lsp.layoutGeometry);
    layoutOpen.mockResolvedValueOnce(layoutFixtureGdsOpenResult);
    layoutGeometry.mockClear();

    function PhysicalGdsPanelHarness() {
      const [selectedTarget, setSelectedTarget] = useState<PhysicalLayoutTarget | null>(readyGdsTarget);

      return (
        <PhysicalMainPanel
          activeLayoutFilePath="chip.gds"
          layoutVisibility={readyVisibility}
          selectedTarget={selectedTarget}
          onSelectedTargetChange={setSelectedTarget}
        />
      );
    }

    renderInCodeLayout(<PhysicalGdsPanelHarness />);

    await waitFor(() => expect(screen.getByTestId('physical-layout-editor')).toHaveAttribute('data-status', 'ready'));
    expect(layoutOpen).toHaveBeenCalledWith({
      workspaceFilePath: 'chip.gds',
      title: 'chip.gds',
    });
    expect(layoutGeometry).not.toHaveBeenCalledWith(expect.objectContaining({
      gdsRootCellIndices: [1],
    }));
    expect(screen.getByTestId('physical-layout-canvas')).toHaveAttribute('data-gds-render-mode', 'tile-mesh');
    expect(screen.getByTestId('physical-layout-canvas')).toHaveAttribute('data-gds-render-batch-mode', 'order-bucket');
    expect(screen.getByTestId('physical-layout-canvas')).toHaveAttribute('data-gds-render-bucket-size', '1');
    expect(screen.getByTestId('physical-layout-canvas')).toHaveAttribute('data-gds-mesh-batch-count', '2');
    expect(screen.getByTestId('physical-layout-canvas')).toHaveAttribute('data-gds-draw-node-count', '3');
    await waitFor(() => expect(screen.getByTestId('physical-gds-toolbar-metrics')).toBeInTheDocument());
    expect(screen.getByTestId('physical-gds-toolbar-metrics')).toHaveAttribute('data-gds-mesh-batch-count', '2');
    expect(screen.getByTestId('physical-gds-toolbar-metrics')).toHaveAttribute('data-gds-draw-node-count', '3');
    expect(screen.getByTestId('physical-gds-toolbar-metrics-mesh-value')).toHaveTextContent('2');
    expect(screen.getByTestId('physical-layout-canvas')).toHaveAttribute('data-selected-macro-name', '');
  });

  it('renders the 3D canvas split for selected GDS cell geometry', async () => {
    const user = userEvent.setup();
    const layoutOpen = vi.mocked(getTestElectronApi().lsp.layoutOpen);
    const selectedGdsShapes = layoutFixtureGdsGeometry.shapes.filter((shape) => shape.macroIndex === readyGdsTarget.index);
    const gdsVisibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, selectedGdsShapes);
    layoutOpen.mockResolvedValueOnce(layoutFixtureGdsOpenResult);

    function PhysicalGdsPanelHarness() {
      const [selectedTarget, setSelectedTarget] = useState<PhysicalLayoutTarget | null>(readyGdsTarget);

      return (
        <PhysicalMainPanel
          activeLayoutFilePath="chip.gds"
          layoutVisibility={gdsVisibility}
          selectedTarget={selectedTarget}
          onSelectedTargetChange={setSelectedTarget}
        />
      );
    }

    renderInCodeLayout(<PhysicalGdsPanelHarness />);

    await waitFor(() => expect(screen.getByTestId('physical-layout-editor')).toHaveAttribute('data-status', 'ready'));
    await waitFor(() => expect(screen.getByTestId('physical-layout-editor')).toHaveAttribute('data-3d-supported', 'true'));
    await user.click(screen.getByTestId('physical-layout-3d-toggle'));

    expect(screen.getByTestId('physical-layout-editor')).toHaveAttribute('data-3d-supported', 'true');
    expect(screen.getByTestId('physical-layout-3d-split')).toBeInTheDocument();
    expect(screen.getByTestId('panel-physical-layout-2d-panel')).toHaveAttribute('data-default-size', '50');
    expect(screen.getByTestId('panel-physical-layout-3d-panel')).toHaveAttribute('data-default-size', '50');
    expect(screen.getByTestId('physical-layout-3d-resize-indicator')).toHaveClass('w-[var(--ide-scrollbar-size)]');
    expect(screen.getByTestId('physical-layout-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-renderer', 'three-webgl');
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-viewport-framed', 'true');
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-viewport-left-border', 'false');
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-orbit-origin', 'bounds3d');
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-base-grid-depth-test', 'true');
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-depth-write-mode', 'solid-mesh');
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-material-side', 'double');
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-orbit-render-mode', 'raf-ref-interaction-idle-sync');
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-shape-opacity-mode', 'opaque');
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-view-helper-visible', 'true');
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-view-helper-background', 'transparent');
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-view-helper-size', '112');
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-view-helper-animating', 'false');
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-selected-target-name', 'CHILD');
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-source-kind', 'gds');
  });

  it('syncs highlighted shape state between 2D and 3D canvases', async () => {
    const user = userEvent.setup();
    const layoutOpen = vi.mocked(getTestElectronApi().lsp.layoutOpen);
    const selectedGdsShapes = layoutFixtureGdsGeometry.shapes.filter((shape) => shape.macroIndex === readyGdsTarget.index);
    const gdsVisibility = createPhysicalLayoutVisibility(layoutFixtureGdsOpenResult.catalog, true, selectedGdsShapes);
    layoutOpen.mockResolvedValueOnce(layoutFixtureGdsOpenResult);

    function PhysicalGdsPanelHarness() {
      const [selectedTarget, setSelectedTarget] = useState<PhysicalLayoutTarget | null>(readyGdsTarget);
      const [highlightedShapeIndex, setHighlightedShapeIndex] = useState<number | null>(null);

      return (
        <PhysicalMainPanel
          activeLayoutFilePath="chip.gds"
          highlightedShapeIndex={highlightedShapeIndex}
          layoutVisibility={gdsVisibility}
          selectedTarget={selectedTarget}
          onHighlightedShapeChange={setHighlightedShapeIndex}
          onSelectedTargetChange={setSelectedTarget}
        />
      );
    }

    renderInCodeLayout(<PhysicalGdsPanelHarness />);

    await waitFor(() => expect(screen.getByTestId('physical-layout-editor')).toHaveAttribute('data-status', 'ready'));
    await waitFor(() => expect(screen.getByTestId('physical-layout-editor')).toHaveAttribute('data-3d-supported', 'true'));
    await user.click(screen.getByTestId('physical-layout-3d-toggle'));
    const selectedGdsShapeIndex = layoutFixtureGdsGeometry.shapes[0]?.index;
    const nextGdsShapeIndex = layoutFixtureGdsGeometry.shapes[1]?.index;

    await user.click(screen.getByTestId('physical-layout-canvas'));

    expect(screen.getByTestId('physical-layout-canvas')).toHaveAttribute('data-highlighted-shape-index', String(selectedGdsShapeIndex));
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-highlighted-shape-index', String(selectedGdsShapeIndex));

    await user.click(screen.getByTestId('physical-layout-3d-canvas'));

    expect(screen.getByTestId('physical-layout-canvas')).toHaveAttribute('data-highlighted-shape-index', String(nextGdsShapeIndex));
    expect(screen.getByTestId('physical-layout-3d-canvas')).toHaveAttribute('data-highlighted-shape-index', String(nextGdsShapeIndex));
  });

  it('switches the physical left panel tabs and activates macros', async () => {
    const user = userEvent.setup();
    const onTargetActivate = vi.fn();
    const onFileToggle = vi.fn();
    renderInCodeLayout(
      <PhysicalLeftPanel
        activeLayoutFilePath="sg13g2_stdcell.lef"
        catalog={layoutFixtureOpenResult.catalog}
        expandedLayoutFilePaths={new Set(['sg13g2_stdcell.lef'])}
        layoutFiles={layoutFiles}
        selectedTarget={readyTarget}
        onLayoutFileToggle={onFileToggle}
        onLayoutTargetActivate={onTargetActivate}
      />,
    );

    expect(screen.getByTestId('physical-left-panel-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('physical-left-panel-split-toggle')).toHaveAttribute('aria-label', 'Show lower physical left panel');
    expect(screen.getByTestId('physical-left-panel-tab-layout')).toBeInTheDocument();
    expect(screen.getByTestId('physical-left-panel-tab-constraints')).toBeInTheDocument();
    expect(screen.getByTestId('physical-layout-file-tree')).toBeInTheDocument();
    expect(screen.getByTestId('physical-layout-file-item-sg13g2_stdcell-lef')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('physical-layout-file-icon-sg13g2_stdcell-lef')).toHaveAttribute('data-icon-color', '#52a8ff');
    expect(screen.getByTestId('physical-layout-file-icon-chip-gds')).toHaveAttribute('data-icon-color', '#4dd599');
    expect(screen.getByTestId('physical-layout-target-item-macro-sg13g2_inv_1')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('physical-layout-target-icon-macro-sg13g2_inv_1')).toHaveAttribute('data-icon-color', '#52a8ff');

    await user.click(screen.getByTestId('physical-layout-target-item-macro-sg13g2_nand2_1'));

    expect(onTargetActivate).toHaveBeenCalledWith(nandTarget);

    await user.click(screen.getByTestId('physical-left-panel-tab-constraints'));

    expect(screen.getByTestId('physical-left-panel-constraints-content')).toHaveTextContent('Constraints');
  });

  it('toggles the physical left lower panel', async () => {
    const user = userEvent.setup();
    const onSplitPanelVisibleChange = vi.fn();
    renderInCodeLayout(
      <PhysicalLeftPanel
        activeLayoutFilePath="sg13g2_stdcell.lef"
        catalog={layoutFixtureOpenResult.catalog}
        expandedLayoutFilePaths={new Set(['sg13g2_stdcell.lef'])}
        layoutFiles={layoutFiles}
        selectedTarget={readyTarget}
        onSplitPanelVisibleChange={onSplitPanelVisibleChange}
      />,
    );

    expect(screen.queryByTestId('physical-left-panel-split-group')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('physical-left-panel-split-toggle'));

    expect(screen.getByTestId('physical-left-panel-split-group')).toBeInTheDocument();
    expect(screen.getByTestId('physical-left-panel-split-resize-handle')).toBeInTheDocument();
    expect(screen.getByTestId('physical-left-panel-lower-panel-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('physical-left-lower-panel-tab-details')).toBeInTheDocument();
    expect(screen.getByTestId('physical-left-lower-panel-tab-notes')).toBeInTheDocument();
    expect(screen.getByTestId('physical-left-lower-panel-details-content')).toHaveTextContent('Layer Details');
    expect(screen.getByTestId('physical-left-panel-split-toggle')).toHaveAttribute('aria-label', 'Hide lower physical left panel');
    expect(onSplitPanelVisibleChange).toHaveBeenCalledWith(true);

    await user.click(screen.getByTestId('physical-left-panel-split-toggle'));

    expect(screen.getByTestId('physical-left-panel-split-toggle')).toHaveAttribute('aria-label', 'Show lower physical left panel');
  });

  it('renders physical right layer tree and toggles category visibility', async () => {
    const user = userEvent.setup();
    const layoutGeometry = vi.mocked(getTestElectronApi().lsp.layoutGeometry);
    const onLayerCategoryVisibilityToggle = vi.fn();
    const onLayerOpacityChange = vi.fn();
    const onOutlineVisibilityToggle = vi.fn();
    layoutGeometry.mockClear();
    renderInCodeLayout(
      <PhysicalRightPanel
        layoutVisibility={readyVisibility}
        layoutState={readyLayoutState}
        selectedTarget={readyTarget}
        onLayerCategoryVisibilityToggle={onLayerCategoryVisibilityToggle}
        onLayerOpacityChange={onLayerOpacityChange}
        onOutlineVisibilityToggle={onOutlineVisibilityToggle}
      />,
    );

    expect(screen.getByTestId('physical-right-panel-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('physical-right-panel-split-toggle')).toHaveAttribute('aria-label', 'Show lower physical right panel');
    expect(screen.getByTestId('physical-right-panel-tab-layers')).toBeInTheDocument();
    expect(screen.getByTestId('physical-right-panel-tab-checks')).toBeInTheDocument();
    expect(screen.getByTestId('physical-layer-outline-row')).toHaveTextContent('Outline');
    expect(screen.getByTestId('physical-layer-outline-swatch')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('physical-right-panel-layers-content')).toHaveTextContent('Metal1');
    expect(screen.getByTestId('physical-right-panel-layers-content')).toHaveTextContent('Metal2');
    expect(screen.getByTestId('physical-layer-opacity-button-0')).toHaveTextContent('Metal1');
    expect(screen.getByTestId('physical-layer-opacity-button-0')).toHaveClass('text-[11px]', 'font-medium', 'leading-5');
    expect(screen.getByTestId('physical-layer-opacity-value-0')).toHaveTextContent('100%');
    expect(screen.getByTestId('physical-layer-row-0')).toHaveTextContent('Pin');
    expect(screen.getByTestId('physical-layer-row-0')).toHaveTextContent('Label');
    expect(screen.getByTestId('physical-layer-row-0')).toHaveTextContent('Obstruction');
    expect(screen.getByTestId('physical-layer-category-swatch-0-pin')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('physical-layer-category-swatch-0-label')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('physical-layer-category-swatch-0-obstruction')).toBeDisabled();
    expect(screen.getByTestId('physical-layer-category-row-0-obstruction')).toHaveAttribute('aria-disabled', 'true');

    await user.click(screen.getByTestId('physical-layer-opacity-button-0'));
    expect(screen.queryByTestId('physical-layer-opacity-popover-0')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('physical-layer-opacity-row-0')).getByTestId('physical-layer-opacity-slider-0')).toBeInTheDocument();
    await user.click(screen.getByTestId('physical-layer-opacity-decrease-0'));

    await user.click(screen.getByTestId('physical-layer-outline-swatch'));
    await user.click(screen.getByTestId('physical-layer-category-swatch-0-pin'));

    expect(onLayerOpacityChange).toHaveBeenCalled();
    expect(onOutlineVisibilityToggle).toHaveBeenCalledTimes(1);
    expect(onLayerCategoryVisibilityToggle).toHaveBeenCalledWith(0, 'pin');
    expect(layoutGeometry).not.toHaveBeenCalled();

    await user.click(screen.getByTestId('physical-right-panel-tab-checks'));

    expect(screen.getByTestId('physical-right-panel-checks-content')).toHaveTextContent('Checks');
  });

  it('disables layer tree rows that have no selected macro data', () => {
    renderInCodeLayout(
      <PhysicalRightPanel
        layoutVisibility={nandVisibility}
        layoutState={readyLayoutState}
        selectedTarget={nandTarget}
      />,
    );

    expect(screen.getByTestId('physical-layer-row-0')).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByTestId('physical-layer-category-swatch-0-pin')).toBeDisabled();
    expect(screen.getByTestId('physical-layer-category-swatch-0-label')).toBeDisabled();
    expect(screen.getByTestId('physical-layer-category-swatch-0-obstruction')).toBeDisabled();
    expect(screen.getByTestId('physical-layer-row-1')).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByTestId('physical-layer-category-swatch-1-obstruction')).not.toBeDisabled();
  });

  it('toggles the physical right lower panel', async () => {
    const user = userEvent.setup();
    const onSplitPanelVisibleChange = vi.fn();
    renderInCodeLayout(<PhysicalRightPanel onSplitPanelVisibleChange={onSplitPanelVisibleChange} />);

    expect(screen.queryByTestId('physical-right-panel-split-group')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('physical-right-panel-split-toggle'));

    expect(screen.getByTestId('physical-right-panel-split-group')).toBeInTheDocument();
    expect(screen.getByTestId('physical-right-panel-split-resize-handle')).toBeInTheDocument();
    expect(screen.getByTestId('physical-right-panel-lower-panel-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('physical-right-lower-panel-tab-inspector')).toBeInTheDocument();
    expect(screen.getByTestId('physical-right-lower-panel-tab-notes')).toBeInTheDocument();
    expect(screen.getByTestId('physical-right-panel-inspector-content')).toHaveTextContent('Inspector');
    expect(screen.getByTestId('physical-right-panel-split-toggle')).toHaveAttribute('aria-label', 'Hide lower physical right panel');
    expect(onSplitPanelVisibleChange).toHaveBeenCalledWith(true);

    await user.click(screen.getByTestId('physical-right-panel-split-toggle'));

    expect(screen.getByTestId('physical-right-panel-split-toggle')).toHaveAttribute('aria-label', 'Show lower physical right panel');
  });

  it('shows selected shape details in the right lower inspector', async () => {
    const user = userEvent.setup();
    renderInCodeLayout(
      <PhysicalRightPanel
        highlightedShapeIndex={layoutFixtureGeometry.shapes[0]?.index}
        layoutVisibility={readyVisibility}
        layoutState={readyLayoutState}
        selectedTarget={readyTarget}
      />,
    );

    await user.click(screen.getByTestId('physical-right-panel-split-toggle'));

    expect(screen.getByTestId('physical-inspector-selected-shape')).toHaveTextContent('Selected Shape');
    expect(screen.getByTestId('physical-inspector-selected-shape-index')).toHaveTextContent(String(layoutFixtureGeometry.shapes[0]?.index));
    expect(screen.getByTestId('physical-inspector-selected-shape-layer')).toHaveTextContent('Metal1');
    expect(screen.getByTestId('physical-inspector-selected-shape-kind')).toHaveTextContent(layoutFixtureGeometry.shapes[0]?.kind ?? '');
    expect(screen.getByTestId('physical-inspector-selected-shape-bounds')).toHaveTextContent('0.120');
  });

  it('switches bottom tabs and calls bottom panel controls', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onMaximizeToggle = vi.fn();
    renderInCodeLayout(
      <PhysicalBottomPanel
        layoutState={readyLayoutState}
        onClose={onClose}
        onMaximizeToggle={onMaximizeToggle}
      />,
    );

    expect(screen.getByTestId('physical-bottom-panel-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('physical-bottom-panel-tab-reports')).toBeInTheDocument();
    expect(screen.getByTestId('physical-bottom-panel-tab-console')).toBeInTheDocument();
    expect(screen.getByTestId('physical-bottom-panel-reports-content')).toHaveTextContent('Macros');

    await user.click(screen.getByTestId('physical-bottom-panel-tab-console'));

    expect(screen.getByTestId('physical-bottom-panel-console-content')).toHaveTextContent('Console');

    await user.click(screen.getByTestId('physical-bottom-panel-maximize'));
    await user.click(screen.getByTestId('physical-bottom-panel-close'));

    expect(onMaximizeToggle).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
