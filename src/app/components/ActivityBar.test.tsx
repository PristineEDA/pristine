import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActivityBar } from './ActivityBar';

describe('ActivityBar', () => {
  it('renders compile, run, and debug action buttons and removes settings', () => {
    render(<ActivityBar activeView="explorer" onItemSelect={vi.fn()} />);

    const buttons = [
      screen.getByTestId('activity-action-compile'),
      screen.getByTestId('activity-action-run'),
      screen.getByTestId('activity-action-debug-action'),
    ];

    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Compile', 'Run', 'Debug']);
    expect(screen.queryByTitle('Settings')).not.toBeInTheDocument();
    expect(screen.getByTitle('Explorer')).toBeInTheDocument();
    expect(screen.getByTitle('Run & Debug')).toBeInTheDocument();
    expect(screen.queryByTitle('Search')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Extensions')).not.toBeInTheDocument();
  });

  it('does not apply pressed state or call the shared navigation handler when compile, run, and debug are clicked', () => {
    const onItemSelect = vi.fn();

    render(<ActivityBar activeView="explorer" onItemSelect={onItemSelect} />);

    const compileButton = screen.getByTestId('activity-action-compile');
    const runButton = screen.getByTestId('activity-action-run');
    const debugButton = screen.getByTestId('activity-action-debug-action');

    expect(compileButton).not.toHaveAttribute('aria-pressed');
    expect(runButton).not.toHaveAttribute('aria-pressed');
    expect(debugButton).not.toHaveAttribute('aria-pressed');

    fireEvent.click(runButton);
    fireEvent.click(debugButton);

    expect(compileButton).not.toHaveAttribute('aria-pressed');
    expect(runButton).not.toHaveAttribute('aria-pressed');
    expect(debugButton).not.toHaveAttribute('aria-pressed');
    expect(onItemSelect).not.toHaveBeenCalled();
  });

  it('forwards clicked item ids to the shared selection handler', () => {
    const onItemSelect = vi.fn();

    render(<ActivityBar activeView="explorer" onItemSelect={onItemSelect} />);

    fireEvent.click(screen.getByTestId('activity-item-debug'));
    fireEvent.click(screen.getByTestId('activity-item-explorer'));

    expect(onItemSelect).toHaveBeenNthCalledWith(1, 'debug');
    expect(onItemSelect).toHaveBeenNthCalledWith(2, 'explorer');
  });

  it('uses the unselected button style for the active item when the left sidebar is hidden', () => {
    render(
      <ActivityBar
        activeView="explorer"
        onItemSelect={vi.fn()}
        isLeftSidebarHidden
      />,
    );

    const explorerButton = screen.getByTestId('activity-item-explorer');

    expect(explorerButton).toHaveClass('text-ide-text-muted', 'border-transparent');
    expect(explorerButton).not.toHaveClass('text-white', 'border-ide-accent');
  });
});