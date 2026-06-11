import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CodeViewerLayoutProvider } from '../../../context/CodeViewerLayoutContext';
import {
  PhysicalBottomPanel,
  PhysicalLeftPanel,
  PhysicalMainPanel,
  PhysicalRightPanel,
} from './PhysicalWorkspacePanels';

function renderInCodeLayout(node: ReactNode) {
  return render(
    <CodeViewerLayoutProvider>
      {node}
    </CodeViewerLayoutProvider>,
  );
}

describe('PhysicalWorkspacePanels', () => {
  it('renders the main physical placeholder content', () => {
    renderInCodeLayout(<PhysicalMainPanel />);

    expect(screen.getByTestId('physical-main-panel-content')).toHaveTextContent('Physical');
    expect(screen.getByTestId('physical-main-panel-content')).toHaveTextContent('Coming soon');
  });

  it('switches the physical left panel placeholder tabs', async () => {
    const user = userEvent.setup();
    renderInCodeLayout(<PhysicalLeftPanel />);

    expect(screen.getByTestId('physical-left-panel-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('physical-left-panel-split-toggle')).toHaveAttribute('aria-label', 'Show lower physical left panel');
    expect(screen.getByTestId('physical-left-panel-tab-layout')).toBeInTheDocument();
    expect(screen.getByTestId('physical-left-panel-tab-constraints')).toBeInTheDocument();
    expect(screen.getByTestId('physical-left-panel-layout-content')).toHaveTextContent('Layout');

    await user.click(screen.getByTestId('physical-left-panel-tab-constraints'));

    expect(screen.getByTestId('physical-left-panel-constraints-content')).toHaveTextContent('Constraints');
  });

  it('toggles the physical left lower panel', async () => {
    const user = userEvent.setup();
    const onSplitPanelVisibleChange = vi.fn();
    renderInCodeLayout(<PhysicalLeftPanel onSplitPanelVisibleChange={onSplitPanelVisibleChange} />);

    expect(screen.queryByTestId('physical-left-panel-split-group')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('physical-left-panel-split-toggle'));

    expect(screen.getByTestId('physical-left-panel-split-group')).toBeInTheDocument();
    expect(screen.getByTestId('physical-left-panel-split-resize-handle')).toBeInTheDocument();
    expect(screen.getByTestId('physical-left-panel-lower-panel-content')).toHaveTextContent('Layer Details');
    expect(screen.getByTestId('physical-left-panel-split-toggle')).toHaveAttribute('aria-label', 'Hide lower physical left panel');
    expect(onSplitPanelVisibleChange).toHaveBeenCalledWith(true);

    await user.click(screen.getByTestId('physical-left-panel-split-toggle'));

    expect(screen.getByTestId('physical-left-panel-split-toggle')).toHaveAttribute('aria-label', 'Show lower physical left panel');
  });

  it('switches the physical right panel placeholder tabs', async () => {
    const user = userEvent.setup();
    renderInCodeLayout(<PhysicalRightPanel />);

    expect(screen.getByTestId('physical-right-panel-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('physical-right-panel-split-toggle')).toHaveAttribute('aria-label', 'Show lower physical right panel');
    expect(screen.getByTestId('physical-right-panel-tab-inspector')).toBeInTheDocument();
    expect(screen.getByTestId('physical-right-panel-tab-checks')).toBeInTheDocument();
    expect(screen.getByTestId('physical-right-panel-inspector-content')).toHaveTextContent('Inspector');

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
    expect(screen.getByTestId('physical-right-panel-lower-panel-content')).toHaveTextContent('Selection Details');
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
        onClose={onClose}
        onMaximizeToggle={onMaximizeToggle}
      />,
    );

    expect(screen.getByTestId('physical-bottom-panel-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('physical-bottom-panel-tab-reports')).toBeInTheDocument();
    expect(screen.getByTestId('physical-bottom-panel-tab-console')).toBeInTheDocument();
    expect(screen.getByTestId('physical-bottom-panel-reports-content')).toHaveTextContent('Reports');

    await user.click(screen.getByTestId('physical-bottom-panel-tab-console'));

    expect(screen.getByTestId('physical-bottom-panel-console-content')).toHaveTextContent('Console');

    await user.click(screen.getByTestId('physical-bottom-panel-maximize'));
    await user.click(screen.getByTestId('physical-bottom-panel-close'));

    expect(onMaximizeToggle).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
