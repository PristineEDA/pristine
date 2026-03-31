import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MenuBar } from './MenuBar';

describe('MenuBar', () => {
  it('calls electron window controls when titlebar buttons are clicked', () => {
    render(<MenuBar />);

    fireEvent.click(screen.getByTestId('window-control-minimize'));
    fireEvent.click(screen.getByTestId('window-control-maximize'));
    fireEvent.click(screen.getByTestId('window-control-close'));

    expect(window.electronAPI?.minimize).toHaveBeenCalledTimes(1);
    expect(window.electronAPI?.maximize).toHaveBeenCalledTimes(1);
    expect(window.electronAPI?.close).toHaveBeenCalledTimes(1);
  });

  it('does not render the select project dropdown or upgrade button', () => {
    render(<MenuBar />);

    expect(screen.queryByRole('button', { name: /select project/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upgrade to pro/i })).not.toBeInTheDocument();
  });

  it('calls the panel toggle callbacks from the layout icons', () => {
    const onToggleLeftPanel = vi.fn();
    const onToggleBottomPanel = vi.fn();
    const onToggleRightPanel = vi.fn();

    render(
      <MenuBar
        onToggleLeftPanel={onToggleLeftPanel}
        onToggleBottomPanel={onToggleBottomPanel}
        onToggleRightPanel={onToggleRightPanel}
      />,
    );

    fireEvent.click(screen.getByTestId('toggle-left-panel'));
    fireEvent.click(screen.getByTestId('toggle-bottom-panel'));
    fireEvent.click(screen.getByTestId('toggle-right-panel'));

    expect(onToggleLeftPanel).toHaveBeenCalledTimes(1);
    expect(onToggleBottomPanel).toHaveBeenCalledTimes(1);
    expect(onToggleRightPanel).toHaveBeenCalledTimes(1);
  });

  it('reflects active panel visibility on the layout buttons', () => {
    render(
      <MenuBar
        showLeftPanel
        showBottomPanel={false}
        showRightPanel
      />,
    );

    expect(screen.getByTestId('toggle-left-panel')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('toggle-bottom-panel')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('toggle-right-panel')).toHaveAttribute('aria-pressed', 'true');
  });
});