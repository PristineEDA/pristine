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
import { filterVisibleLayoutShapes } from './physicalLayoutLayers';

vi.mock('./PhysicalLayoutCanvas', () => ({
  PhysicalLayoutCanvas: ({
    catalog,
    geometry,
    selectedMacroName,
    visibleLayerIndices,
  }: {
    catalog: typeof layoutFixtureOpenResult.catalog | null;
    geometry: typeof layoutFixtureGeometry | null;
    selectedMacroName: string | null;
    visibleLayerIndices: ReadonlySet<number>;
  }) => (
    <div
      data-layer-count={catalog?.layers.length ?? 0}
      data-macro-count={catalog?.macros.length ?? 0}
      data-renderer="webgl"
      data-selected-macro-name={selectedMacroName ?? ''}
      data-shape-count={geometry?.shapes.length ?? 0}
      data-testid="physical-layout-canvas"
      data-visible-shape-count={geometry ? filterVisibleLayoutShapes(geometry.shapes, visibleLayerIndices).length : 0}
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
        selectedMacroName={null}
        visibleLayerIndices={new Set([0, 1])}
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

  it('switches physical right layers and checks tabs', async () => {
    const user = userEvent.setup();
    const onLayerVisibilityToggle = vi.fn();
    renderInCodeLayout(
      <PhysicalRightPanel
        layoutState={readyLayoutState}
        selectedMacroName="sg13g2_inv_1"
        visibleLayerIndices={new Set([0, 1])}
        onLayerVisibilityToggle={onLayerVisibilityToggle}
      />,
    );

    expect(screen.getByTestId('physical-right-panel-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('physical-right-panel-split-toggle')).toHaveAttribute('aria-label', 'Show lower physical right panel');
    expect(screen.getByTestId('physical-right-panel-tab-layers')).toBeInTheDocument();
    expect(screen.getByTestId('physical-right-panel-tab-checks')).toBeInTheDocument();
    expect(screen.getByTestId('physical-right-panel-layers-content')).toHaveTextContent('Metal1');
    expect(screen.getByTestId('physical-right-panel-layers-content')).toHaveTextContent('Metal2');

    await user.click(screen.getByTestId('physical-layer-swatch-0'));

    expect(onLayerVisibilityToggle).toHaveBeenCalledWith(0);

    await user.click(screen.getByTestId('physical-right-panel-tab-checks'));

    expect(screen.getByTestId('physical-right-panel-checks-content')).toHaveTextContent('Checks');
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
