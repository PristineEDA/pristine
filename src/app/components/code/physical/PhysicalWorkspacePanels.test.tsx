import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { layoutFixtureGdsOpenResult, layoutFixtureGeometry, layoutFixtureOpenResult } from '../../../../test/layoutFixture';
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
  filterVisiblePhysicalLayoutShapes,
  isPhysicalLayoutOutlineVisible,
  type PhysicalLayoutVisibility,
} from './physicalLayoutLayers';
import { selectMacroShapes, type PhysicalLayoutTarget } from './physicalLayoutGeometry';

vi.mock('./PhysicalLayoutCanvas', () => ({
  PhysicalLayoutCanvas: ({
    catalog,
    geometry,
    layoutVisibility,
    selectedTarget,
  }: {
    catalog: typeof layoutFixtureOpenResult.catalog | null;
    geometry: typeof layoutFixtureGeometry | null;
    layoutVisibility: PhysicalLayoutVisibility;
    selectedTarget: PhysicalLayoutTarget | null;
  }) => (
    <div
      data-layer-count={catalog?.layers.length ?? 0}
      data-macro-count={catalog?.macros.length ?? 0}
      data-renderer="webgl"
      data-selected-macro-name={selectedTarget?.kind === 'macro' ? selectedTarget.name : ''}
      data-shape-count={geometry?.shapes.length ?? 0}
      data-outline-visible={isPhysicalLayoutOutlineVisible(layoutVisibility) ? 'true' : 'false'}
      data-testid="physical-layout-canvas"
      data-visible-label-names="A|Y"
      data-visible-shape-count={geometry ? filterVisiblePhysicalLayoutShapes(geometry.shapes, layoutVisibility).length : 0}
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
const layoutFiles = [{ extension: '.lef', name: 'sg13g2_stdcell.lef', path: 'sg13g2_stdcell.lef' }];

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

  it('requests GDS cell geometry by selected cell index', async () => {
    const layoutOpen = vi.mocked(getTestElectronApi().lsp.layoutOpen);
    const layoutGeometry = vi.mocked(getTestElectronApi().lsp.layoutGeometry);
    const selectedCellTarget: PhysicalLayoutTarget = { kind: 'gdsCell', name: 'CHILD', index: 1 };
    layoutOpen.mockResolvedValueOnce(layoutFixtureGdsOpenResult);
    layoutGeometry.mockClear();

    function PhysicalGdsPanelHarness() {
      const [selectedTarget, setSelectedTarget] = useState<PhysicalLayoutTarget | null>(selectedCellTarget);

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
    expect(layoutGeometry).toHaveBeenCalledWith({
      sessionId: 'layout-test-session',
      maxShapes: 0,
      gdsRootCellIndices: [1],
    });
    expect(screen.getByTestId('physical-layout-canvas')).toHaveAttribute('data-selected-macro-name', '');
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
    expect(screen.getByTestId('physical-layout-target-item-macro-sg13g2_inv_1')).toHaveAttribute('aria-selected', 'true');

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
    const onOutlineVisibilityToggle = vi.fn();
    layoutGeometry.mockClear();
    renderInCodeLayout(
      <PhysicalRightPanel
        layoutVisibility={readyVisibility}
        layoutState={readyLayoutState}
        selectedTarget={readyTarget}
        onLayerCategoryVisibilityToggle={onLayerCategoryVisibilityToggle}
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
    expect(screen.getByTestId('physical-layer-row-0')).toHaveTextContent('Pin');
    expect(screen.getByTestId('physical-layer-row-0')).toHaveTextContent('Label');
    expect(screen.getByTestId('physical-layer-row-0')).toHaveTextContent('Obstruction');
    expect(screen.getByTestId('physical-layer-category-swatch-0-pin')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('physical-layer-category-swatch-0-label')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('physical-layer-category-swatch-0-obstruction')).toBeDisabled();
    expect(screen.getByTestId('physical-layer-category-row-0-obstruction')).toHaveAttribute('aria-disabled', 'true');

    await user.click(screen.getByTestId('physical-layer-outline-swatch'));
    await user.click(screen.getByTestId('physical-layer-category-swatch-0-pin'));

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
