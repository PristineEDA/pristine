import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActivityBar } from './ActivityBar';

describe('ActivityBar', () => {
  it('renders compile and run action buttons and removes settings', () => {
    render(<ActivityBar activeView="explorer" onItemSelect={vi.fn()} />);

    const buttons = [
      screen.getByTestId('activity-action-compile'),
      screen.getByTestId('activity-action-run'),
    ];

    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Compile', 'Run']);
    expect(screen.queryByTestId('activity-action-debug-action')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explorer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simulation' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Extensions' })).not.toBeInTheDocument();
  });

  it('does not apply pressed state or call the shared navigation handler when compile and run are clicked', () => {
    const onItemSelect = vi.fn();

    render(<ActivityBar activeView="explorer" onItemSelect={onItemSelect} />);

    const compileButton = screen.getByTestId('activity-action-compile');
    const runButton = screen.getByTestId('activity-action-run');

    expect(compileButton).not.toHaveAttribute('aria-pressed');
    expect(runButton).not.toHaveAttribute('aria-pressed');

    fireEvent.click(runButton);

    expect(compileButton).not.toHaveAttribute('aria-pressed');
    expect(runButton).not.toHaveAttribute('aria-pressed');
    expect(onItemSelect).not.toHaveBeenCalled();
  });

  it('forwards clicked item ids to the shared selection handler', () => {
    const onItemSelect = vi.fn();

    render(<ActivityBar activeView="explorer" onItemSelect={onItemSelect} />);

    fireEvent.click(screen.getByTestId('activity-item-simulation'));
    fireEvent.click(screen.getByTestId('activity-item-explorer'));

    expect(onItemSelect).toHaveBeenNthCalledWith(1, 'simulation');
    expect(onItemSelect).toHaveBeenNthCalledWith(2, 'explorer');
  });

  it('uses the selected button style for the active item', () => {
    render(<ActivityBar activeView="explorer" onItemSelect={vi.fn()} />);

    const explorerButton = screen.getByTestId('activity-item-explorer');

    expect(explorerButton).toHaveClass('text-foreground', 'border-primary');
    expect(explorerButton).not.toHaveClass('text-muted-foreground', 'border-transparent');
  });

  it('adds a pointer cursor on hover for navigation and action buttons', () => {
    render(<ActivityBar activeView="explorer" onItemSelect={vi.fn()} />);

    expect(screen.getByTestId('activity-item-explorer')).toHaveClass('hover:cursor-pointer');
    expect(screen.getByTestId('activity-action-compile')).toHaveClass('hover:cursor-pointer');
  });

  it('renders shadcn tooltip content for navigation and action buttons on hover', async () => {
    const user = userEvent.setup();

    render(<ActivityBar activeView="explorer" onItemSelect={vi.fn()} />);

    await user.hover(screen.getByTestId('activity-item-explorer'));
    expect(await screen.findByRole('tooltip', { name: 'Explorer' })).toBeInTheDocument();
  });
});