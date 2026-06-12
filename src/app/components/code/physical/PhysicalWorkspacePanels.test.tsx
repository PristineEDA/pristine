import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { layoutFixtureGeometry, layoutFixtureOpenResult } from '../../../../test/layoutFixture';
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
import { findLayoutMacro, selectMacroShapes } from './physicalLayoutGeometry';

vi.mock('./PhysicalLayoutCanvas', () => ({
  PhysicalLayoutCanvas: ({
    catalog,
    geometry,
    layoutVisibility,
    selectedMacroName,
  }: {
    catalog: typeof layoutFixtureOpenResult.catalog | null;
    geometry: typeof layoutFixtureGeometry | null;
    layoutVisibility: PhysicalLayoutVisibility;
    selectedMacroName: string | null;
  }) => (
    <div
      data-layer-count={catalog?.layers.length ?? 0}
      data-macro-count={catalog?.macros.length ?? 0}
      data-renderer="webgl"
      data-selected-macro-name={selectedMacroName ?? ''}
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
const readyMacro = findLayoutMacro(layoutFixtureOpenResult.catalog, 'sg13g2_inv_1');
const readyMacroShapes = selectMacroShapes(layoutFixtureOpenResult.catalog, layoutFixtureGeometry, 'sg13g2_inv_1');
const readyVisibility = createPhysicalLayoutVisibility(layoutFixtureOpenResult.catalog, readyMacro, readyMacroShapes);
const nandMacro = findLayoutMacro(layoutFixtureOpenResult.catalog, 'sg13g2_nand2_1');
const nandMacroShapes = selectMacroShapes(layoutFixtureOpenResult.catalog, layoutFixtureGeometry, 'sg13g2_nand2_1');
const nandVisibility = createPhysicalLayoutVisibility(layoutFixtureOpenResult.catalog, nandMacro, nandMacroShapes);

function renderInCodeLayout(node: ReactNode) {
  return render(
    <CodeViewerLayoutProvider>
      {node}
    </CodeViewerLayoutProvider>,
  );
}

describe('PhysicalWorkspacePanels', () => {
  it('renders the main physical layout editor content', async () => {
    const onLayoutStateChange = vi.fn();
    const onSelectedMacroNameChange = vi.fn();
    renderInCodeLayout(
      <PhysicalMainPanel
        layoutVisibility={readyVisibility}
        selectedMacroName={null}
        onLayoutStateChange={onLayoutStateChange}
        onSelectedMacroNameChange={onSelectedMacroNameChange}
      />,
    );

    expect(screen.getByTestId('physical-layout-editor')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('physical-layout-editor')).toHaveAttribute('data-status', 'ready'));
    expect(screen.getByTestId('physical-layout-canvas')).toHaveAttribute('data-renderer', 'webgl');
    expect(onSelectedMacroNameChange).toHaveBeenCalledWith('sg13g2_inv_1');
    expect(onLayoutStateChange).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ready',
      catalog: layoutFixtureOpenResult.catalog,
      geometry: layoutFixtureGeometry,
    }));
  });

  it('switches the physical left panel tabs and activates macros', async () => {
    const user = userEvent.setup();
    const onMacroActivate = vi.fn();
    renderInCodeLayout(
      <PhysicalLeftPanel
        catalog={layoutFixtureOpenResult.catalog}
        selectedMacroName="sg13g2_inv_1"
        onMacroActivate={onMacroActivate}
      />,
    );

    expect(screen.getByTestId('physical-left-panel-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('physical-left-panel-split-toggle')).toHaveAttribute('aria-label', 'Show lower physical left panel');
    expect(screen.getByTestId('physical-left-panel-tab-layout')).toBeInTheDocument();
    expect(screen.getByTestId('physical-left-panel-tab-constraints')).toBeInTheDocument();
    expect(screen.getByTestId('physical-layout-macro-list')).toBeInTheDocument();
    expect(screen.getByTestId('physical-layout-macro-item-sg13g2_inv_1')).toHaveAttribute('aria-selected', 'true');

    await user.dblClick(screen.getByTestId('physical-layout-macro-item-sg13g2_nand2_1'));

    expect(onMacroActivate).toHaveBeenCalledWith('sg13g2_nand2_1');

    await user.click(screen.getByTestId('physical-left-panel-tab-constraints'));

    expect(screen.getByTestId('physical-left-panel-constraints-content')).toHaveTextContent('Constraints');
  });

  it('toggles the physical left lower panel', async () => {
    const user = userEvent.setup();
    const onSplitPanelVisibleChange = vi.fn();
    renderInCodeLayout(
      <PhysicalLeftPanel
        catalog={layoutFixtureOpenResult.catalog}
        selectedMacroName="sg13g2_inv_1"
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
    const onLayerCategoryVisibilityToggle = vi.fn();
    const onOutlineVisibilityToggle = vi.fn();
    renderInCodeLayout(
      <PhysicalRightPanel
        layoutVisibility={readyVisibility}
        layoutState={readyLayoutState}
        selectedMacroName="sg13g2_inv_1"
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

    await user.click(screen.getByTestId('physical-right-panel-tab-checks'));

    expect(screen.getByTestId('physical-right-panel-checks-content')).toHaveTextContent('Checks');
  });

  it('disables layer tree rows that have no selected macro data', () => {
    renderInCodeLayout(
      <PhysicalRightPanel
        layoutVisibility={nandVisibility}
        layoutState={readyLayoutState}
        selectedMacroName="sg13g2_nand2_1"
      />,
    );

    expect(screen.getByTestId('physical-layer-row-0')).toHaveAttribute('aria-disabled', 'true');
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
